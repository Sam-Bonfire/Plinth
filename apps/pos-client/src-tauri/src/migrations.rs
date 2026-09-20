use rusqlite::{params, Connection, Result};

/// A single versioned schema migration.
///
/// Table migrations land in follow-up tasks (orders, menu, tickets); this
/// module only owns ordering, bookkeeping, and idempotent application.
/// Append new entries to [`MIGRATIONS`] with a strictly increasing version.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    /// Monotonic schema version. Must be unique across [`MIGRATIONS`].
    pub version: i64,
    /// Human-readable label for logs and debugging.
    pub name: &'static str,
    /// DDL/DML applied inside a transaction together with bookkeeping.
    pub sql: &'static str,
}

/// Ordered schema migrations. Empty until table tasks append entries.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "0001_orders",
        sql: "
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                terminal_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                status TEXT NOT NULL,
                table_id TEXT,
                seat_number INTEGER,
                subtotal_minor INTEGER NOT NULL,
                discount_minor INTEGER NOT NULL DEFAULT 0,
                tax_minor INTEGER NOT NULL DEFAULT 0,
                total_minor INTEGER NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS order_line_items (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                menu_item_id TEXT NOT NULL,
                name TEXT NOT NULL,
                unit_price_minor INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                fired_quantity INTEGER NOT NULL DEFAULT 0,
                tax_rate TEXT NOT NULL,
                notes TEXT,
                seat_number INTEGER
            );

            CREATE TABLE IF NOT EXISTS order_payments (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                method TEXT NOT NULL,
                amount_minor INTEGER NOT NULL,
                status TEXT NOT NULL,
                reference TEXT,
                recorded_by TEXT NOT NULL,
                recorded_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_orders_tenant_location_created ON orders(tenant_id, location_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_orders_tenant_location_status ON orders(tenant_id, location_id, status);
        ",
    },
    Migration {
        version: 2,
        name: "0002_menu",
        sql: "
            CREATE TABLE IF NOT EXISTS menu_categories (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                deleted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                primary_category_id TEXT NOT NULL REFERENCES menu_categories(id),
                name TEXT NOT NULL,
                description TEXT,
                price_minor INTEGER NOT NULL,
                tax_rate TEXT NOT NULL,
                is_veg INTEGER NOT NULL DEFAULT 1,
                is_available INTEGER NOT NULL DEFAULT 1,
                sku TEXT,
                kitchen_station TEXT NOT NULL,
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_menu_items_catalog ON menu_items(tenant_id, location_id, primary_category_id, is_available);
        ",
    },
    Migration {
        version: 3,
        name: "0003_tickets",
        sql: "
            CREATE TABLE IF NOT EXISTS kitchen_tickets (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                station TEXT NOT NULL,
                kot_number INTEGER NOT NULL,
                status TEXT NOT NULL,
                sla_warning_sec INTEGER NOT NULL,
                sla_late_sec INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                bumped_at TEXT,
                bumped_by TEXT,
                cancelled_at TEXT,
                cancellation_reason TEXT
            );

            CREATE TABLE IF NOT EXISTS ticket_line_items (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                ticket_id TEXT NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
                line_item_id TEXT NOT NULL,
                menu_item_id TEXT NOT NULL,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                modifiers_json TEXT,
                special_instructions TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_active ON kitchen_tickets(tenant_id, location_id, station, status);
        ",
    },
    Migration {
        version: 4,
        name: "0004_sync_queue",
        sql: sync_protocol::queue::SYNC_QUEUE_SQLITE_DDL,
    },
    Migration {
        version: 5,
        name: "0005_staff_audit_shifts",
        sql: "
            CREATE TABLE IF NOT EXISTS staff_members (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                permissions INTEGER NOT NULL DEFAULT 0,
                pin_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                payload_json TEXT,
                is_anomaly INTEGER NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS store_shifts (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                location_id TEXT NOT NULL,
                terminal_id TEXT NOT NULL,
                opened_by TEXT NOT NULL,
                opened_at TEXT NOT NULL,
                closed_at TEXT,
                opening_float_minor INTEGER NOT NULL,
                closing_cash_minor INTEGER,
                expected_cash_minor INTEGER,
                is_closed INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_staff_members_tenant_location ON staff_members(tenant_id, location_id, is_active);
            CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_time ON audit_events(tenant_id, location_id, timestamp DESC);
        ",
    }
];

/// Applies [`MIGRATIONS`] to an open connection.
///
/// # Errors
///
/// Returns [`rusqlite::Error`] if bookkeeping setup fails or any pending
/// migration (including its version record) cannot be applied.
pub fn migrate(conn: &mut Connection) -> Result<Vec<i64>> {
    apply_migrations(conn, MIGRATIONS)
}

/// Applies the given migrations in slice order, skipping versions already
/// recorded in `schema_migrations`. Each migration runs in its own
/// transaction together with its version record. A version listed twice is a
/// programming error and fails loudly on the second attempt instead of being
/// silently skipped.
///
/// # Errors
///
/// Returns [`rusqlite::Error`] if bookkeeping setup fails or any pending
/// migration cannot be applied.
fn apply_migrations(conn: &mut Connection, migrations: &[Migration]) -> Result<Vec<i64>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             version INTEGER PRIMARY KEY,
             name TEXT NOT NULL,
             applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         )",
    )?;
    let applied_versions: Vec<i64> = conn
        .prepare("SELECT version FROM schema_migrations")?
        .query_map(params![], |row| row.get(0))?
        .collect::<Result<Vec<i64>>>()?;

    let mut applied = Vec::new();
    for migration in migrations {
        if applied_versions.contains(&migration.version) {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(migration.sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2)",
            params![migration.version, migration.name],
        )?;
        tx.commit()?;
        applied.push(migration.version);
    }
    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;

    const CREATE_WIDGETS: Migration = Migration {
        version: 1,
        name: "test_create_widgets",
        sql: "CREATE TABLE widgets (id INTEGER PRIMARY KEY, label TEXT NOT NULL)",
    };
    const SEED_WIDGETS: Migration = Migration {
        version: 2,
        name: "test_seed_widgets",
        sql: "INSERT INTO widgets (id, label) VALUES (1, 'sprocket')",
    };

    #[test]
    fn applies_pending_in_order_and_reaps_versions() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let applied =
            apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("migrate");
        assert_eq!(applied, vec![1, 2]);
        let label: String = conn
            .query_row("SELECT label FROM widgets WHERE id = 1", params![], |row| {
                row.get(0)
            })
            .expect("seeded row");
        assert_eq!(label, "sprocket");
    }

    #[test]
    fn second_run_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("first migrate");
        let applied =
            apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("second migrate");
        assert!(applied.is_empty(), "nothing pending on second run");
    }

    #[test]
    fn failing_migration_rolls_back_without_version_record() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let bad = Migration {
            version: 3,
            name: "test_broken",
            sql: "CREATE TABLE missing_paren (",
        };
        let result = apply_migrations(&mut conn, &[CREATE_WIDGETS, bad]);
        assert!(result.is_err(), "broken SQL must fail");
        let versions: Vec<i64> = conn
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .expect("prepare")
            .query_map(params![], |row| row.get(0))
            .expect("query")
            .collect::<Result<Vec<i64>>>()
            .expect("collect");
        assert_eq!(versions, vec![1], "only the good migration is recorded");
        let tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'missing_paren'",
                params![],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(tables, 0, "failed migration left no table");
    }

    #[test]
    fn migrate_applies_all_and_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let applied = migrate(&mut conn).expect("first migrate");
        assert_eq!(applied, vec![1, 2, 3, 4, 5]);

        let applied_second = migrate(&mut conn).expect("second migrate");
        assert!(applied_second.is_empty());
    }

    #[test]
    fn fk_enforcement() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        conn.execute("PRAGMA foreign_keys = ON", params![]).expect("fk");
        migrate(&mut conn).expect("migrate");

        let res = conn.execute(
            "INSERT INTO order_line_items (id, tenant_id, location_id, order_id, menu_item_id, name, unit_price_minor, quantity, fired_quantity, tax_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params!["oli1", "t1", "loc1", "nonexistent_order", "mi1", "pizza", 1000, 1, 0, "0.0"],
        );
        assert!(res.is_err(), "should fail foreign key constraint");
    }

    #[test]
    fn duplicate_version_fails_loudly() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let twice = [CREATE_WIDGETS, CREATE_WIDGETS];
        assert!(apply_migrations(&mut conn, &twice).is_err());
    }
}
