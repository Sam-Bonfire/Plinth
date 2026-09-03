use worker::d1::D1Database;
use worker::Result;

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial_schema.sql");
const PRD_GAPS_SCHEMA: &str = include_str!("../../migrations/0002_prd_gaps.sql");

/// Applies all required migrations to the database.
/// In D1, we can simply execute the SQL scripts.
///
/// # Errors
/// Returns a `worker::Error` if the database execution fails.
pub async fn run_migrations(db: &D1Database) -> Result<()> {
    db.exec(INITIAL_SCHEMA).await?;
    db.exec(PRD_GAPS_SCHEMA).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_initial_schema_execution() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");

        conn.execute_batch(INITIAL_SCHEMA).expect("Failed to execute initial schema");

        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").unwrap();
        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(table_names.contains(&"orders".to_string()));
        assert!(table_names.contains(&"menu_items".to_string()));

        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='index'").unwrap();
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

        conn.execute_batch(INITIAL_SCHEMA).expect("Failed to execute initial schema");
        conn.execute_batch(PRD_GAPS_SCHEMA).expect("Failed to execute PRD gaps schema");

        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").unwrap();
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

        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='index'").unwrap();
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
        conn.execute_batch(INITIAL_SCHEMA).expect("Failed first run");
        conn.execute_batch(PRD_GAPS_SCHEMA).expect("Failed second run");
        // Re-run should succeed due to IF NOT EXISTS
        conn.execute_batch(PRD_GAPS_SCHEMA).expect("Failed idempotent rerun");
    }
}
