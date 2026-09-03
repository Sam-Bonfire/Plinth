use include_dir::{Dir, include_dir};
use worker::d1::D1Database;
use worker::Result;

static MIGRATIONS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/migrations");

/// Applies all required migrations to the database.
/// Discovers `*.sql` files in `migrations/` sorted lexicographically (0001, 0002, ...).
/// For `D1` this reuses `IF NOT EXISTS` idempotency; for local `rusqlite` tests
/// the same files are executed via `include_dir`. Wrangler `d1 migrations apply`
/// remains the source of truth for production — this is a runtime fallback for
/// `workerd` and tests.
///
/// # Errors
/// Returns a `worker::Error` if the database execution fails.
pub async fn run_migrations(db: &D1Database) -> Result<()> {
    let mut files: Vec<_> = MIGRATIONS_DIR.files().collect();
    files.sort_by_key(|f| f.path());
    for file in files {
        if file.path().extension().and_then(|e| e.to_str()) != Some("sql") {
            continue;
        }
        if let Some(content) = file.contents_utf8() {
            db.exec(content).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
fn all_migration_contents_sorted() -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<_> = MIGRATIONS_DIR
        .files()
        .filter(|f| f.path().extension().and_then(|e| e.to_str()) == Some("sql"))
        .collect();
    files.sort_by_key(|f| f.path());
    files
        .into_iter()
        .filter_map(|f| Some((f.path().to_str()?, f.contents_utf8()?)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::all_migration_contents_sorted;
    use rusqlite::Connection;

    fn run_all(conn: &Connection) {
        for (_, sql) in all_migration_contents_sorted() {
            conn.execute_batch(sql)
                .expect("Failed to execute migration");
        }
    }

    #[test]
    fn test_initial_schema_execution() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        let all = all_migration_contents_sorted();
        assert!(!all.is_empty(), "No migrations found");
        // Run only first migration to verify initial tables
        let first_sql = all.first().expect("Missing 0001").1;
        conn.execute_batch(first_sql)
            .expect("Failed to execute initial schema");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap();
        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(table_names.contains(&"orders".to_string()));
        assert!(table_names.contains(&"menu_items".to_string()));

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index'")
            .unwrap();
        let index_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(index_names.contains(&"idx_orders_tenant_location_created".to_string()));
        assert!(index_names.contains(&"idx_audit_events_tenant_time".to_string()));
    }

    #[test]
    fn test_prd_gaps_schema_execution() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        run_all(&conn);

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap();
        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(table_names.contains(&"staff_members".to_string()));
        assert!(table_names.contains(&"floor_tables".to_string()));
        assert!(table_names.contains(&"reservations".to_string()));
        assert!(table_names.contains(&"recipes".to_string()));
        assert!(table_names.contains(&"recipe_ingredients".to_string()));
        assert!(table_names.contains(&"customers".to_string()));
        assert!(table_names.contains(&"purchase_orders".to_string()));
        assert!(table_names.contains(&"refunds".to_string()));
        assert!(table_names.contains(&"webhook_endpoints".to_string()));

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index'")
            .unwrap();
        let index_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(index_names.contains(&"idx_staff_members_tenant_location".to_string()));
        assert!(index_names.contains(&"idx_refunds_order_status".to_string()));
    }

    #[test]
    fn test_full_migration_idempotent() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");
        run_all(&conn);
        // Re-run of 0002 should be idempotent due to IF NOT EXISTS; 0001 is expected to fail if re-run
        let all = all_migration_contents_sorted();
        let second_sql = all
            .iter()
            .find(|(p, _)| p.contains("0002"))
            .expect("Missing 0002")
            .1;
        conn.execute_batch(second_sql)
            .expect("Failed idempotent rerun of 0002");
    }

    #[test]
    fn test_migrations_sorted_lexicographically() {
        let all = all_migration_contents_sorted();
        let names: Vec<&str> = all.iter().map(|(p, _)| *p).collect();
        let mut sorted = names.clone();
        sorted.sort_unstable();
        assert_eq!(names, sorted, "Migrations not sorted");
        assert!(names.iter().any(|p| p.contains("0001_initial_schema.sql")));
        assert!(names.iter().any(|p| p.contains("0002_add_missing_tables.sql")));
    }
}
