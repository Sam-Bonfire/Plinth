# 19_database-schema.md - D1 Multi-Tenant Schema Documentation

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `13_deployment-guide.md` (deployment workflow prerequisite)
- `18_monitoring-and-observability.md` (schema monitoring context)
- `04_hexagonal-architecture.md` (schema lies in outbound adapters)
- `05_bounded-contexts.md` (schema supports four contexts)
- `AGENTS.md` (multi-tenant isolation mandate)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 19.1 Core Tables Summary

PlinthOS uses Cloudflare D1 (serverless SQLite) as its persistent cloud relational source of truth. All queries **mandatorily** bind `tenant_id` and `location_id` for multi-tenant isolation (per `AGENTS.md` Section 3).

### 19.1.1 Table Inventory

| Table Name | Context | Primary Purpose | Key Columns |
|---|---|---|---|
| **orders** | Ordering | Master order aggregate state | `id`, `tenant_id`, `location_id`, `status`, `total_cents`, `channel`, `created_at`, `deleted_at` |
| **order_line_items** | Ordering | Line items with prices, modifiers, fire status | `id`, `order_id`, `menu_item_id`, `quantity`, `fired_quantity`, `tax_rate`, `notes`, `seat_number` |
| **order_payments** | Ordering | Payment tender records | `id`, `order_id`, `method`, `amount_cents`, `reference`, `status`, `recorded_at` |
| **kitchen_tickets** | Kitchen Execution | KDS ticket headers | `id`, `order_id`, `status`, `daily_ kot_number`, `bumped_at`, `sla_deadline` |
| **ticket_line_items** | Kitchen Execution | Station-specific items with modifiers | `id`, `ticket_id`, `station_id`, `modifiers`, `prep_instructions`, `course_stage` |
| **menu_categories** | Ordering | Catalog hierarchy | `id`, `tenant_id`, `parent_id`, `name`, `tax_slab`, `is_86'd` |
| **menu_items** | Ordering | Catalog items with pricing | `id`, `category_id`, `name`, `base_price_cents`, `tax_rate`, `is_86'd`, `photo_url` |
| **stock_items** | Inventory | Inventory levels per location | `id`, `tenant_id`, `location_id`, `name`, `unit_qty`, `reorder_point`, `current_qty` |
| **recipes** | Inventory | Maps menu items to stock items | `id`, `menu_item_id`, `stock_item_id`, `unit_qty`, `conversion_factor` |
| **store_shifts** | Tenant Billing | Till open/close cycles | `id`, `tenant_id`, `location_id`, `cash_start`, `cash_end`, `variance_cents` |
| **z_reports** | Tenant Billing | End-of-shift reconciliation | `id`, `shift_id`, `revenue_cents`, `cash_summary`, `tax_liability_cents`, `generated_at` |
| **audit_events** | All | Tamper-evident security trail | `id`, `tenant_id`, `actor_id`, `action`, `details_json`, `created_at` |
| **mutation_records** | Sync Protocol | Offline sync queue | `id`, `tenant_id`, `location_id`, `payload_json`, `signature`, `vector_clock`, `status` |

---

## 19.2 Multi-Tenant Isolation

### 19.2.1 Mandatory Binding

**Every** query executed through `TenantDbSession` (per `04_hexagonal-architecture.md` and `apps/edge-api/src/db/mod.rs`) must bind:

```rust
let stmt = self.db.prepare(sql)
    .bind(&[self.context.tenant_id.to_string(), self.context.location_id.to_string()])?;
```

**Violation consequences**:
- Runtime error (panic) if bindings missing
- CI/CD gate failure (linter rule `require_tenant_bindings`)
- Security audit flag

### 19.2.2 Tenant Isolation in Practice

| Scenario | Correct Approach | Incorrect Approach |
|---|---|---|
| **Fetch order by ID** | `WHERE order_id = ? AND tenant_id = ? AND location_id = ?` | `WHERE order_id = ?` (cross-tenant data leak) |
| **List KDS tickets** | `WHERE tenant_id = ? AND location_id = ?` | Omit clauses (returns tickets from all locations) |
| **Update stock level** | `UPDATE stock_items SET current_qty = ? WHERE tenant_id = ? AND stock_item_id = ?` | Omit tenant/location (updates all locations' stock) |

### 19.2.3 Index Recommendations

For performance with multi-tenant binding, these indexes are recommended (created in migration `0002_add_indexes.sql`):

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_orders_tenant_loc` | `orders` | `(tenant_id, location_id)` | Fast order lookup per site |
| `idx_order_items_order` | `order_line_items` | `(order_id)` | Item aggregation per order |
| `idx_tickets_order` | `kitchen_tickets` | `(order_id)` | KDS ticket routing |
| `idx_stock_tenant_loc` | `stock_items` | `(tenant_id, location_id)` | Inventory per site |
| `idx_mutations_tenant` | `mutation_records` | `(tenant_id, location_id, status)` | Sync queue filtering |
| `idx_audit_tenant` | `audit_events` | `(tenant_id, created_at)` | Audit trail per site |

---

## 19.3 Schema Evolution (Migrations)

### 19.3.1 Migration File Naming

`YYYYMMDD_description.sql` pattern, stored in `apps/edge-api/migrations/`.

**Current migration set** (per `wrangler.toml`):

| Migration | Description | Adds |
|---|---|---|
| `0001_initial_schema.sql` | Core tables for all contexts | `orders`, `order_line_items`, `order_payments`, `kitchen_tickets`, `ticket_line_items`, `menu_categories`, `menu_items`, `stock_items`, `recipes`, `store_shifts`, `z_reports`, `audit_events`, `mutation_records` |
| `0002_add_indexes.sql` | Performance indexes | All indexes listed in 19.2.3 |
| `0003_add_audit_timestamps.sql` | `created_at`/`updated_at`/`deleted_at` on core tables | Soft-delete support, audit trail |
| `0004_tenant_isolation_enhanced.sql` | Enhanced RLS policies | Row-level security (Postgres-style check via `WHERE tenant_id = current_setting('app.tenant_id')`) |

### 19.3.2 Adding a New Migration

1. **Create SQL file**: `20260829_add_return_policy.sql`
2. **Add to `wrangler.toml`**: Append to `migrations` array
3. **Deploy**: `mise run build:api` (auto-applies pending on first start)
4. **Verify**: D1 dashboard → Schema version increment

### 19.3.2 Migration Best Practices

| Practice | Reason |
|---|---|
| **Add columns only** (never `DROP`) | Zero-downtime; existing data preserved |
| **Use `IF NOT EXISTS`** for indexes | Idempotent re-runs |
| **Preserve `deleted_at`** | Audit trail, recovery from accidental deletes |
| **Keep migrations cumulative** | `0005` includes everything from `0001`-`0004` + new |

---

## 19.4 Order Table Detail (`orders`)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID (v7) | NOT NULL | Primary key |
| `tenant_id` | UUID (v7) | NOT NULL | Multi-tenant isolation |
| `location_id` | UUID (v7) | NOT NULL | Site isolation within tenant |
| `status` | TEXT | NOT NULL | `draft`, `submitted`, `in_prep`, `ready`, `bumped`, `settled`, `voided` |
| `channel` | TEXT | NOT NULL | `dine_in`, `takeout`, `delivery`, `kiosk` |
| `total_cents` | INTEGER | NOT NULL | Grand total in minor units (rust_decimal::Decimal → i64) |
| `tax_cents` | INTEGER | NOT NULL | Computed GST total |
| `tip_cents` | INTEGER | DEFAULT 0 | Gratuity added |
| `channel_data` | JSONB | NULL | Channel-specific data (e.g., table_id, delivery_address) |
| `created_at` | TIMESTAMP | NOT NULL | `Utc::now()` at order creation |
| `updated_at` | TIMESTAMP | NOT NULL | Auto-updated on each mutation |
| `deleted_at` | TIMESTAMP | NULL | Soft-delete; NULL = active |

**Key invariants** (enforced in `core-domain`):
- $\sum \text{(Seat Check Totals)} = \text{Order Total}$
- Status transition order enforced by aggregate root
- Payment sufficiency check before `settled` transition

---

## 19.4.1 Order Line Items Detail (`order_line_items`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `order_id` | UUID (v7) | FK → `orders.id` |
| `menu_item_id` | UUID (v7) | FK → `menu_items.id` |
| `quantity` | INTEGER | Ordered quantity |
| `fired_quantity` | INTEGER | quantity already sent to kitchen (`fired <= quantity`) |
| `base_price_cents` | INTEGER | Base price before modifiers |
| `modifier_total_cents` | INTEGER | Price delta from selected modifiers |
| `unit_price_cents` | INTEGER | `base_price_cents + modifier_total_cents` (final line price) |
| `tax_rate` | TEXT | `GST-0`, `GST-5`, `GST-10`, `GST-15` (from `GstRate` enum) |
| `notes` | TEXT | Special preparation instructions |
| `seat_number` | INTEGER | Dining seat assignment (1-8) |

---

## 19.5 Stock Items & Recipes Detail

### 19.5.1 Stock Items (`stock_items`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `tenant_id` | UUID (v7) | Multi-tenant isolation |
| `location_id` | UUID (v7) | Site isolation |
| `name` | TEXT | e.g., "Beef Patty", "White Rice" |
| `unit_qty` | TEXT | e.g., "each", "kg", "liter", "portion" |
| `conversion_factor` | INTEGER | How many base units in this unit (e.g., 1 kg = 1000 g → factor 1000) |
| `current_qty` | INTEGER | Current on-hand quantity (in base units) |
| `reorder_point` | INTEGER | Threshold that triggers `StockReorderAlert` event |
| `maximum_stock` | INTEGER | Optimal ceiling; exceeds may trigger storage-cost alerts |
| `last_counted_at` | TIMESTAMP | When physical count was last performed |

### 19.5.2 Recipes (`recipes`)

Maps menu items to required stock:

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `menu_item_id` | UUID (v7) | FK → `menu_items.id` |
| `stock_item_id` | UUID (v7) | FK → `stock_items.id` |
| `unit_qty` | INTEGER | How much of this stock item required per menu item |
| `conversion_factor` | INTEGER | If `stock_item` unit ≠ `menu_item` expected unit |
| **Example**: Butter Chicken recipe → `stock_item`: chicken breast, `unit_qty`: 2, `conversion_factor`: 1 (each per chicken) |

**Automatic deduction**: When `ORDER_SUBMITTED` event received → recipe deductions executed → `current_qty` decremented → if `< reorder_point` → `StockReorderAlert` emitted.

---

## 19.6 Shift & Z-Report Detail

### 19.6.1 Store Shifts (`store_shifts`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `tenant_id` | UUID (v7) | NOT NULL |
| `location_id` | UUID (v7) | NOT NULL |
| `cash_start` | INTEGER | Opening float in minor units |
| `cash_end` | INTEGER | Closing count; NULL if shift open |
| `variance_cents` | INTEGER | `cash_end - cash_start - total_card_etc`; NULL if shift open |
| `opened_at` | TIMESTAMP | NOT NULL |
| `closed_at` | TIMESTAMP | NULL if shift still open |
| `opened_by` | UUID (v7) | Staff member who opened shift |
| `closed_by` | UUID (v7) | Staff member who closed shift (NULL if open) |

### 19.6.2 Z-Reports (`z_reports`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `shift_id` | UUID (v7) | FK → `store_shifts.id` |
| `revenue_cents` | INTEGER | Total sales (all tenders) |
| `tax_liability_cents` | INTEGER | Computed GST total for period |
| `cash_summary_json` | JSON | Breakdown: `{"total":500,"50":3,"20":7,"10":12,"1":4,"0.50":8}` |
| `card_breakdown_json` | JSON | `{"visa":1234,"mc":987,"ax":234,"disc":56}` |
| `upi_total_cents` | INTEGER | UPI payment total |
| `tip_total_cents` | INTEGER | Tips collected during shift |
| `generated_at` | TIMESTAMP | NOT NULL |
| `generated_by` | UUID (v7) | Staff member who generated Z-Report |

---

## 19.7 Audit Events Detail

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `tenant_id` | UUID (v7) | NOT NULL |
| `actor_id` | UUID (v7) | Staff member who performed action |
| `action` | TEXT | `order_created`, `order_settled`, `stock_deducted`, `shift_closed`, etc. |
| `details_json` | JSON | Free-form key-value pairs for event context |
| `created_at` | TIMESTAMP | NOT NULL |
| `previous_state_json` | JSON | Optional; state before the action (for diff/rollback) |

**Example audit entry**:
```json
{
  "id": "aud-84093",
  "tenant_id": "tenant_42",
  "actor_id": "staff-99",
  "action": "order_settled",
  "details_json": {"order_id":"ord-701","total_cents":71400,"payment_method":"CASH"},
  "created_at": "2026-08-28T14:30:00Z",
  "previous_state_json": {"status":"submitted","total_cents":71000}
}
```

---

## 19.8 Mutation Records (Sync Protocol)

Per `packages/sync-protocol` CRDT design, each offline mutation is tracked:

| Column | Type | Description |
|---|---|---|
| `id` | UUID (v7) | Primary key |
| `tenant_id` | UUID (v7) | NOT NULL |
| `location_id` | UUID (v7) | NOT NULL |
| `payload_json` | JSON | Serialized mutation (order add/change/settle, stock deduction, etc.) |
| `signature` | TEXT | Ed25519 signature over payload (authenticity) |
| `vector_clock` | TEXT | JSON: `{"node_id": "dos-1", "sequence": 42}` (causal ordering) |
| `status` | TEXT | `pending`, `settled`, `conflict` |
| `created_at` | TIMESTAMP | NOT NULL |
| `resolved_at` | TIMESTAMP | NULL if still pending |

**Sync flow**:
1. POS local SQLite → mutation recorded in `mutation_records` status=pending
2. Tokio sync daemon → reads pending → WebSocket to Durable Object → Object broadcasts
3. DO → acknowledges → `mutation_records.status` → `settled`
4. If conflict (vector clocks incomparable) → status → `conflict` → manual resolution

---

## 19.9 Next Steps After Reading Schema Documentation

After reading this file, proceed with:

1. **Examine actual migration files**:
   - `apps/edge-api/migrations/0001_initial_schema.sql`
   - `apps/edge-api/migrations/0002_add_indexes.sql`

2. **Review the `TenantDbSession` implementation**:
   - `apps/edge-api/src/db/mod.rs` - how bindings are enforced

3. **Run a schema query** (local dev):
   ```bash
   cd apps/edge-api
   wrangler d1 execute plinth_cellar --remote --text "SELECT count(*) FROM orders"
   ```

4. **Read** `05_bounded-contexts.md` for how each context uses these tables

5. **Read** `18_monitoring-and-observability.md` for schema-related metrics

---

## 19.10 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - D1 schema documentation |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new schema additions |

---
*This file is part of the PlinthOS internal developer documentation set. See `13_deployment-guide.md` for deployment commands, `18_monitoring-and-observability.md` for observability, and `AGENTS.md` for the multi-tenant isolation mandate.*