-- Customer login event log.
-- NOTE: tier/visits/spend stay domain-side until a versioned migration
-- runner lands; every statement here must remain re-runnable because
-- run_migrations executes all files on every boot (IF NOT EXISTS only).

CREATE TABLE IF NOT EXISTS login_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 1,
    occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_events_tenant_time ON login_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
