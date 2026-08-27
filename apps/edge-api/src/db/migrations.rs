use worker::d1::D1Database;
use worker::Result;

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial_schema.sql");

/// Applies all required migrations to the database.
/// In D1, we can simply execute the SQL scripts.
///
/// # Errors
/// Returns a `worker::Error` if the database execution fails.
pub async fn run_migrations(db: &D1Database) -> Result<()> {
    // Note: D1 execute() might be batched or we might need to prepare and run each statement.
    // For simple use cases, exec() executes the statements.
    db.exec(INITIAL_SCHEMA).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_initial_schema_execution() {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory database");

        // Execute the migration script
        conn.execute_batch(INITIAL_SCHEMA).expect("Failed to execute initial schema");

        // Verify tables exist
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").unwrap();
        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(table_names.contains(&"orders".to_string()));
        assert!(table_names.contains(&"menu_items".to_string()));

        // Verify indexes exist
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='index'").unwrap();
        let index_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(index_names.contains(&"idx_orders_tenant_location_created".to_string()));
        assert!(index_names.contains(&"idx_audit_events_tenant_time".to_string()));
    }
}
