-- Migration: 0009_webhook_idempotency.sql
-- Adds idempotency tracking for webhooks

ALTER TABLE webhook_deliveries ADD COLUMN idempotency_key TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN order_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_idempotency ON webhook_deliveries(endpoint_id, idempotency_key);
