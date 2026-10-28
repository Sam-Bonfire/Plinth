-- Migration: 0012_auth_sessions.sql
-- Rebuild the refresh-token store so staff and customer sessions share it.
-- The original table bound every row to staff_members, which cannot hold a
-- customer session. Rows are keyed by (subject_type, subject_id) instead.

CREATE TABLE refresh_tokens_v2 (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

INSERT INTO refresh_tokens_v2 (id, tenant_id, location_id, subject_type, subject_id, token_hash, expires_at, revoked_at, created_at)
SELECT id, tenant_id, '', 'staff', staff_id, token_hash, expires_at, revoked_at, created_at FROM refresh_tokens;

DROP TABLE refresh_tokens;

ALTER TABLE refresh_tokens_v2 RENAME TO refresh_tokens;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_subject ON refresh_tokens(tenant_id, subject_type, subject_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
