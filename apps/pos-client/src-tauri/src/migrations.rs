use rusqlite::{Connection, Result, params};

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
pub const MIGRATIONS: &[Migration] = &[];

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
        let applied = apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("migrate");
        assert_eq!(applied, vec![1, 2]);
        let label: String = conn
            .query_row("SELECT label FROM widgets WHERE id = 1", params![], |row| row.get(0))
            .expect("seeded row");
        assert_eq!(label, "sprocket");
    }

    #[test]
    fn second_run_is_idempotent() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("first migrate");
        let applied = apply_migrations(&mut conn, &[CREATE_WIDGETS, SEED_WIDGETS]).expect("second migrate");
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
    fn migrate_with_empty_list_applies_nothing() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let applied = migrate(&mut conn).expect("migrate");
        assert!(applied.is_empty());
    }

    #[test]
    fn duplicate_version_fails_loudly() {
        let mut conn = Connection::open_in_memory().expect("memory db");
        let twice = [CREATE_WIDGETS, CREATE_WIDGETS];
        assert!(apply_migrations(&mut conn, &twice).is_err());
    }
}
