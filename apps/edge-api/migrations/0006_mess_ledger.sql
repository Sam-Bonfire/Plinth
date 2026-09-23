CREATE TABLE IF NOT EXISTS mess_accounts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mess_accounts_tenant ON mess_accounts(tenant_id);

CREATE TABLE IF NOT EXISTS mess_ledger_entries (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES mess_accounts(id) ON DELETE CASCADE,
    debit_minor INTEGER NOT NULL DEFAULT 0,
    credit_minor INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mess_ledger_entries_account ON mess_ledger_entries(account_id);
