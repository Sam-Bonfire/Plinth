-- Dev-simulator seed. LOCAL ONLY: apply with `mise run db:seed:local`
-- (wrangler d1 execute --local). NEVER apply to a remote database:
-- the staff PIN below is the well-known dev value "1234".
--
-- Canonical ids for hurl runs (export as needed):
--   tenant_id   = 00000000-0000-0000-0000-000000000001
--   location_id = 00000000-0000-0000-0000-000000000002
--   staff Owner   = 00000000-0000-0000-0000-000000000003 (permissions 1023)
--   staff Cashier = 00000000-0000-0000-0000-000000000004 (permissions 513)
--   staff Waiter  = 00000000-0000-0000-0000-000000000005 (permissions 1)
--   menu item     = 00000000-0000-0000-0000-000000000010 (Paneer Tikka, 32000 minor)
--   stock Paneer  = 00000000-0000-0000-0000-000000000030 (recipe ingredient, kg)
--   stock Milk    = 00000000-0000-0000-0000-000000000031 (inventory adjust probe, l)

INSERT OR IGNORE INTO tenants (id, slug, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'plinth-dev', 'Plinth Dev', '2026-01-01T00:00:00Z');

-- Argon2id hash of "1234" with a fixed dev salt. Dev simulator only.
INSERT OR IGNORE INTO staff_members (id, tenant_id, location_id, name, role, permissions, pin_hash, is_active, created_at, updated_at, deleted_at)
VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dev Owner', 'Owner', 1023, '$argon2id$v=19$m=19456,t=2,p=1$cGxpbmRoZXYtc2VlZA$Lbse9knCfcsjM4b36R6GF46yNHQxd2fctC4RO8yERV0', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dev Cashier', 'Cashier', 513, '$argon2id$v=19$m=19456,t=2,p=1$cGxpbmRoZXYtc2VlZA$Lbse9knCfcsjM4b36R6GF46yNHQxd2fctC4RO8yERV0', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dev Waiter', 'Waiter', 1, '$argon2id$v=19$m=19456,t=2,p=1$cGxpbmRoZXYtc2VlZA$Lbse9knCfcsjM4b36R6GF46yNHQxd2fctC4RO8yERV0', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL);

-- Settled order used by the refund lifecycle contract (total 33600 minor).
INSERT OR IGNORE INTO orders (id, tenant_id, location_id, terminal_id, channel, status, table_id, seat_number, subtotal_minor, discount_minor, tax_minor, total_minor, created_by, created_at, updated_at, deleted_at)
VALUES ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'POS-01', 'DineIn', 'Settled', NULL, NULL, 32000, 0, 1600, 33600, '00000000-0000-0000-0000-000000000003', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL);

INSERT OR IGNORE INTO menu_categories (id, tenant_id, location_id, name, display_order, is_active, deleted_at)VALUES ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Starters', 0, 1, NULL);

INSERT OR IGNORE INTO menu_items (id, tenant_id, location_id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station, deleted_at)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000009', 'Paneer Tikka', 'Dev seed item', 32000, 'FivePercent', 1, 1, 'SEED-010', 'Tandoor', NULL);

-- Webhook endpoint for aggregator ingestion contract tests (secret: dev-webhook-secret).
INSERT OR IGNORE INTO webhook_endpoints (id, tenant_id, url, events_json, secret, is_active, created_at)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'http://localhost:8787/webhooks/swiggy', '["order.created"]', 'dev-webhook-secret', 1, '2026-01-01T00:00:00Z');

-- Stock items and the Paneer Tikka recipe. OR REPLACE so a reseed restores the
-- quantities the contract tests assert on. Paneer sits at 10.000 kg with a
-- 9.900 reorder level so a single Paneer Tikka (0.200 kg + 10% wastage) crosses
-- it; orders.hurl asserts that crossing, which proves the deduction ran.
INSERT OR REPLACE INTO stock_items (id, tenant_id, location_id, name, unit, current_quantity, par_level, reorder_level, cost_per_unit_minor, is_active, deleted_at)
VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Paneer', 'Kilogram', '10.000', '20.000', '9.900', 25000, 1, NULL),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Milk', 'Litre', '20.000', '30.000', '5.000', 6000, 1, NULL);

INSERT OR REPLACE INTO recipes (id, tenant_id, location_id, menu_item_id, preparation_notes, created_at, deleted_at)
VALUES ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', 'Marinate 2 hours.', '2026-01-01T00:00:00Z', NULL);

INSERT OR REPLACE INTO recipe_ingredients (id, recipe_id, stock_item_id, quantity, unit, wastage_percent)
VALUES ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000030', '0.200', 'Kilogram', '10');
