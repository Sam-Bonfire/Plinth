-- Migration: 0010_auth_lockout.sql
-- Track authentication attempts to enforce lockouts

CREATE TABLE IF NOT EXISTS auth_attempts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    identifier TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup ON auth_attempts(tenant_id, identifier, occurred_at DESC);
