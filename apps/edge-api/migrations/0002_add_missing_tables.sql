-- Migration: 0002_prd_gaps.sql
-- Adds missing PRD tables for staff, floor plan, shifts, recipes, customers, purchase orders, refunds, webhooks

-- Staff management
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

CREATE TABLE IF NOT EXISTS floor_plans (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS floor_tables (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    floor_plan_id TEXT REFERENCES floor_plans(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    section_name TEXT NOT NULL,
    section_display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES floor_tables(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    reserved_from TEXT NOT NULL,
    reserved_until TEXT NOT NULL,
    is_cancelled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shift_activities (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL REFERENCES store_shifts(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'Inr',
    reason TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- Recipes (BOM for inventory deduction)
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    preparation_notes TEXT,
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    quantity TEXT NOT NULL,
    unit TEXT NOT NULL,
    wastage_percent TEXT NOT NULL DEFAULT '0'
);

-- Customers / Loyalty
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Purchase orders / receiving
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    total_minor INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    received_at TEXT
);

CREATE TABLE IF NOT EXISTS po_line_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
    quantity TEXT NOT NULL,
    unit_cost_minor INTEGER NOT NULL,
    total_minor INTEGER NOT NULL
);

-- Refunds (full/partial/line-item)
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    refund_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'Inr',
    status TEXT NOT NULL DEFAULT 'Pending',
    authorized_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    processed_at TEXT
);

CREATE TABLE IF NOT EXISTS refund_line_items (
    id TEXT PRIMARY KEY,
    refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    line_item_id TEXT NOT NULL REFERENCES order_line_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    amount_minor INTEGER NOT NULL
);

-- Webhooks / Integrations
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    url TEXT NOT NULL,
    events_json TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    response_code INTEGER,
    delivered_at TEXT
);

-- Indexes for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_staff_members_tenant_location ON staff_members(tenant_id, location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_floor_tables_tenant_location ON floor_tables(tenant_id, location_id, floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_time ON reservations(table_id, reserved_from);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(tenant_id, location_id, menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_status ON purchase_orders(tenant_id, location_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_order_status ON refunds(tenant_id, location_id, order_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON webhook_endpoints(tenant_id, is_active);
