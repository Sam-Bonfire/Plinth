CREATE TABLE IF NOT EXISTS menu_sync_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    menu_version TEXT NOT NULL,
    item_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_sync_runs_tenant ON menu_sync_runs(tenant_id, platform);
