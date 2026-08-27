-- Migration: 0001_initial_schema.sql
-- Create initial schema for Plinth D1

CREATE TABLE orders (
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

CREATE TABLE order_line_items (
    id TEXT PRIMARY KEY,
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

CREATE TABLE order_payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL,
    reference TEXT,
    recorded_by TEXT NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE TABLE kitchen_tickets (
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

CREATE TABLE ticket_line_items (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    line_item_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    modifiers_json TEXT,
    special_instructions TEXT
);

CREATE TABLE menu_categories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
);

CREATE TABLE menu_items (
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

CREATE TABLE stock_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_quantity TEXT NOT NULL,
    par_level TEXT NOT NULL,
    reorder_level TEXT NOT NULL,
    cost_per_unit_minor INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT
);

CREATE TABLE store_shifts (
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

CREATE TABLE audit_events (
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

CREATE TABLE mutation_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    mutation_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    signature TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

-- High-Performance Multi-Tenant Indexing
CREATE INDEX idx_orders_tenant_location_created ON orders(tenant_id, location_id, created_at DESC);
CREATE INDEX idx_orders_tenant_location_status ON orders(tenant_id, location_id, status);
CREATE INDEX idx_kitchen_tickets_active ON kitchen_tickets(tenant_id, location_id, station, status);
CREATE INDEX idx_menu_items_catalog ON menu_items(tenant_id, location_id, primary_category_id, is_available);
CREATE INDEX idx_stock_items_inventory ON stock_items(tenant_id, location_id, is_active);
CREATE INDEX idx_audit_events_tenant_time ON audit_events(tenant_id, location_id, timestamp DESC);
