-- Migration: 0013_vendors_recipes_purchase_orders.sql
-- Adds vendors table and updates purchase_orders with vendor_id

CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    rate TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_location ON vendors(tenant_id, location_id);

-- Alter purchase_orders to add vendor_id
-- We keep supplier_name for legacy rows, vendor_id will be populated for new ones
ALTER TABLE purchase_orders ADD COLUMN vendor_id TEXT REFERENCES vendors(id);
