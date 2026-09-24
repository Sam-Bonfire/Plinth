CREATE TABLE IF NOT EXISTS marketing_leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    outlets INTEGER NOT NULL DEFAULT 1,
    city TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_created ON marketing_leads(created_at);
