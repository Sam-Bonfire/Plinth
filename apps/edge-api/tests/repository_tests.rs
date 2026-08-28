#![deny(unsafe_code)]

use rusqlite::{params, Connection};

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory SQLite database");
    conn.execute_batch("PRAGMA foreign_keys = ON;").expect("Failed to enable foreign keys");

    let migration_sql = include_str!("../migrations/0001_initial_schema.sql");
    conn.execute_batch(migration_sql).expect("Failed to execute initial migration schema");

    conn
}

#[test]
fn test_schema_initialization_and_indexes() {
    let conn = setup_test_db();

    // Verify tables exist
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        .unwrap();
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();

    assert!(tables.contains(&"orders".to_string()));
    assert!(tables.contains(&"order_line_items".to_string()));
    assert!(tables.contains(&"order_payments".to_string()));
    assert!(tables.contains(&"kitchen_tickets".to_string()));
    assert!(tables.contains(&"ticket_line_items".to_string()));
    assert!(tables.contains(&"menu_categories".to_string()));
    assert!(tables.contains(&"menu_items".to_string()));
    assert!(tables.contains(&"stock_items".to_string()));
    assert!(tables.contains(&"store_shifts".to_string()));
    assert!(tables.contains(&"audit_events".to_string()));
}

#[test]
fn test_menu_catalog_crud_and_foreign_key_constraints() {
    let conn = setup_test_db();
    let tenant_id = "tenant-001";
    let location_id = "loc-001";

    // 1. Insert Category
    conn.execute(
        "INSERT INTO menu_categories (id, tenant_id, location_id, name, display_order, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params!["cat-100", tenant_id, location_id, "Main Courses", 1, 1],
    )
    .expect("Failed to insert category");

    // 2. Insert Menu Item referencing Category
    conn.execute(
        "INSERT INTO menu_items (id, tenant_id, location_id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            "item-201",
            tenant_id,
            location_id,
            "cat-100",
            "Paneer Tikka Masala",
            "Rich cottage cheese curry",
            35000,
            "FivePercent",
            1,
            1,
            "PTM-01",
            "Curry"
        ],
    )
    .expect("Failed to insert menu item");

    // 3. Query item with category join
    let mut stmt = conn
        .prepare(
            "SELECT m.name, c.name, m.price_minor, m.tax_rate
             FROM menu_items m
             JOIN menu_categories c ON m.primary_category_id = c.id
             WHERE m.id = ?1 AND m.tenant_id = ?2",
        )
        .unwrap();

    let result = stmt.query_row(params!["item-201", tenant_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
        ))
    });

    let (item_name, cat_name, price, tax_rate) = result.unwrap();
    assert_eq!(item_name, "Paneer Tikka Masala");
    assert_eq!(cat_name, "Main Courses");
    assert_eq!(price, 35000);
    assert_eq!(tax_rate, "FivePercent");

    // 4. Foreign Key Violation: Inserting item referencing non-existent category must fail
    let fk_err = conn.execute(
        "INSERT INTO menu_items (id, tenant_id, location_id, primary_category_id, name, price_minor, tax_rate, kitchen_station)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params!["item-999", tenant_id, location_id, "non-existent-cat", "Ghost Dish", 10000, "FivePercent", "Grill"],
    );
    assert!(fk_err.is_err(), "Expected foreign key constraint violation");
}

#[test]
fn test_order_lifecycle_and_cascade_deletion() {
    let conn = setup_test_db();
    let tenant_id = "tenant-001";
    let location_id = "loc-001";
    let order_id = "ord-777";

    // 1. Insert Order
    conn.execute(
        "INSERT INTO orders (id, tenant_id, location_id, terminal_id, channel, status, table_id, seat_number, subtotal_minor, discount_minor, tax_minor, total_minor, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            order_id,
            tenant_id,
            location_id,
            "term-1",
            "DineIn",
            "Confirmed",
            "tab-12",
            4,
            70000,
            0,
            3500,
            73500,
            "staff-1",
            "2026-08-28T12:00:00Z",
            "2026-08-28T12:00:00Z"
        ],
    )
    .expect("Failed to insert order");

    // 2. Insert Line Items
    conn.execute(
        "INSERT INTO order_line_items (id, order_id, menu_item_id, name, unit_price_minor, quantity, fired_quantity, tax_rate, notes, seat_number)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            "oli-1",
            order_id,
            "item-201",
            "Paneer Tikka Masala",
            35000,
            2,
            0,
            "FivePercent",
            "Less oil",
            4
        ],
    )
    .expect("Failed to insert order line item");

    // 3. Insert Payment
    conn.execute(
        "INSERT INTO order_payments (id, order_id, method, amount_minor, status, reference, recorded_by, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            "pay-1",
            order_id,
            "Upi",
            73500,
            "Completed",
            "UPI-REF-123456",
            "staff-1",
            "2026-08-28T12:05:00Z"
        ],
    )
    .expect("Failed to insert order payment");

    // Verify records exist
    let line_item_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_line_items WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(line_item_count, 1);

    let payment_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_payments WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(payment_count, 1);

    // 4. Cascade Delete Test: Deleting order must cascade and remove line items and payments
    conn.execute("DELETE FROM orders WHERE id = ?1", params![order_id])
        .expect("Failed to delete order");

    let line_item_count_after: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_line_items WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(line_item_count_after, 0, "Line items must be deleted via cascade");

    let payment_count_after: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_payments WHERE order_id = ?1",
            params![order_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(payment_count_after, 0, "Payments must be deleted via cascade");
}

#[test]
fn test_kitchen_tickets_and_status_transitions() {
    let conn = setup_test_db();
    let tenant_id = "tenant-001";
    let location_id = "loc-001";
    let ticket_id = "kot-555";

    // 1. Insert Kitchen Ticket
    conn.execute(
        "INSERT INTO kitchen_tickets (id, order_id, tenant_id, location_id, station, kot_number, status, sla_warning_sec, sla_late_sec, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            ticket_id,
            "ord-100",
            tenant_id,
            location_id,
            "Grill",
            101,
            "Pending",
            300,
            600,
            "2026-08-28T12:00:00Z"
        ],
    )
    .expect("Failed to insert ticket");

    // 2. Insert Ticket Line Item
    conn.execute(
        "INSERT INTO ticket_line_items (id, ticket_id, line_item_id, menu_item_id, name, quantity, modifiers_json, special_instructions)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            "tli-1",
            ticket_id,
            "oli-10",
            "item-201",
            "Paneer Tikka Masala",
            2,
            "[]",
            "Make extra hot"
        ],
    )
    .expect("Failed to insert ticket line item");

    // 3. Bump Ticket
    let affected = conn
        .execute(
            "UPDATE kitchen_tickets
             SET status = 'Bumped', bumped_at = '2026-08-28T12:08:00Z', bumped_by = 'chef-1'
             WHERE id = ?1 AND tenant_id = ?2",
            params![ticket_id, tenant_id],
        )
        .expect("Failed to bump ticket");
    assert_eq!(affected, 1);

    // Verify bumped status
    let status: String = conn
        .query_row(
            "SELECT status FROM kitchen_tickets WHERE id = ?1",
            params![ticket_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "Bumped");

    // Cascade delete ticket
    conn.execute("DELETE FROM kitchen_tickets WHERE id = ?1", params![ticket_id]).unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ticket_line_items WHERE ticket_id = ?1",
            params![ticket_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0, "Ticket line items should be removed via cascade");
}

#[test]
fn test_stock_items_and_inventory_adjustments() {
    let conn = setup_test_db();
    let tenant_id = "tenant-001";
    let location_id = "loc-001";
    let stock_id = "stk-001";

    conn.execute(
        "INSERT INTO stock_items (id, tenant_id, location_id, name, unit, current_quantity, par_level, reorder_level, cost_per_unit_minor, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            stock_id,
            tenant_id,
            location_id,
            "Fresh Paneer",
            "Kilogram",
            "20.5",
            "50.0",
            "10.0",
            40000,
            1
        ],
    )
    .expect("Failed to insert stock item");

    // Query inventory below reorder
    let below_reorder_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM stock_items
             WHERE tenant_id = ?1 AND CAST(current_quantity AS REAL) <= CAST(reorder_level AS REAL)",
            params![tenant_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(below_reorder_count, 0);

    // Adjust stock down to trigger reorder threshold
    conn.execute(
        "UPDATE stock_items SET current_quantity = ?1 WHERE id = ?2",
        params!["8.5", stock_id],
    )
    .unwrap();

    let below_reorder_count_after: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM stock_items
             WHERE tenant_id = ?1 AND CAST(current_quantity AS REAL) <= CAST(reorder_level AS REAL)",
            params![tenant_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(below_reorder_count_after, 1);
}

#[test]
fn test_sql_bind_placeholder_integrity() {
    let conn = setup_test_db();

    // Verify multi-param binding with positional parameters (?1, ?2, ... and ?)
    let res = conn.execute(
        "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            "aud-1",
            "tenant-1",
            "loc-1",
            "staff-1",
            "PRICE_OVERRIDE",
            "Order",
            "ord-1",
            "{\"old_price\": 100, \"new_price\": 80}",
            1,
            "2026-08-28T12:00:00Z"
        ],
    );
    assert!(res.is_ok(), "SQL Bind with 10 exact parameters should succeed");

    let audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM audit_events WHERE tenant_id = ?1 AND is_anomaly = ?2",
            params!["tenant-1", 1],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(audit_count, 1);
}
