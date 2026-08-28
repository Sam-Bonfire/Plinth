# =============================================================================
# PlinthOS API Test Suite: 04 Inventory, Audit & EOD Closure Matrix
# Exhaustive Stock Filtering, Precision Adjustments, Audit Trail & Analytics
# =============================================================================

# -----------------------------------------------------------------------------
# 1. Inventory Query & Filter Matrix
# -----------------------------------------------------------------------------

# 1a. Query all active stock items
GET http://localhost:8787/api/v1/inventory
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# 1b. Filter inventory by is_active == true
GET http://localhost:8787/api/v1/inventory?is_active=true
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1c. Filter inventory by is_active == false
GET http://localhost:8787/api/v1/inventory?is_active=false
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1d. Filter inventory by below_reorder == true
GET http://localhost:8787/api/v1/inventory?below_reorder=true
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1e. Filter inventory by below_reorder == false
GET http://localhost:8787/api/v1/inventory?below_reorder=false
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1f. Filter inventory by unit == Kilogram
GET http://localhost:8787/api/v1/inventory?unit=Kilogram
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1g. Filter inventory by unit == Litre
GET http://localhost:8787/api/v1/inventory?unit=Litre
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1h. Filter inventory by unit == Piece
GET http://localhost:8787/api/v1/inventory?unit=Piece
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# -----------------------------------------------------------------------------
# 2. Inventory Stock Adjustments & Validation
# -----------------------------------------------------------------------------

# 2a. Reject stock adjustment on non-existent stock item ID
POST http://localhost:8787/api/v1/inventory/adjust
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "stock_item_id": "non-existent-stock-uuid-99",
  "delta": "10.5",
  "reason": "PurchaseReceived",
  "notes": "Invoice #90812"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Not Found"

# 2b. Reject stock adjustment with malformed body
POST http://localhost:8787/api/v1/inventory/adjust
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "invalid_key": 123
}
HTTP 400

# -----------------------------------------------------------------------------
# 3. Audit Trail Ingestion Matrix
# -----------------------------------------------------------------------------

# 3a. Ingest PRICE_OVERRIDE audit event with JSON payload
POST http://localhost:8787/api/v1/audit
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "action": "PRICE_OVERRIDE",
  "target_type": "OrderLineItem",
  "target_id": "oli-sample-01",
  "payload_json": "{\"old_price_minor\":45000,\"new_price_minor\":35000,\"reason\":\"VIP Guest discount\"}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.event_id" isString

# 3b. Ingest MANAGER_VOID audit event
POST http://localhost:8787/api/v1/audit
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "action": "MANAGER_VOID",
  "target_type": "Order",
  "target_id": "ord-sample-02",
  "payload_json": "{\"reason\":\"Customer changed mind before preparation\"}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3c. Ingest CASH_DRAWER_OVERRIDE flagged as anomaly
POST http://localhost:8787/api/v1/audit
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "action": "CASH_DRAWER_NO_SALE_OPEN",
  "target_type": "StoreShift",
  "target_id": "shift-sample-01",
  "payload_json": "{\"reason\":\"Till drawer manually opened without sale\"}",
  "is_anomaly": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3d. Reject audit ingestion with invalid JSON
POST http://localhost:8787/api/v1/audit
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "broken": "payload"
}
HTTP 400

# -----------------------------------------------------------------------------
# 4. Sales Analytics Reporting Matrix
# -----------------------------------------------------------------------------

# 4a. Query sales analytics for today
GET http://localhost:8787/api/v1/reports/sales?period=today
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger
jsonpath "$.tax_liability_minor" isInteger

# 4b. Query sales analytics for yesterday
GET http://localhost:8787/api/v1/reports/sales?period=yesterday
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger

# 4c. Query sales analytics by custom date range
GET http://localhost:8787/api/v1/reports/sales?date_from=2026-08-01T00:00:00Z&date_to=2026-08-28T23:59:59Z
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.total_revenue_minor" isInteger

# -----------------------------------------------------------------------------
# 5. End-of-Day Shift Closure & Error Conditions
# -----------------------------------------------------------------------------

# 5a. Reject closure on non-existent shift ID
POST http://localhost:8787/api/v1/eod/close
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "shift_id": "non-existent-shift-uuid-99",
  "physical_cash_minor": 50000,
  "notes": "Safe count verified"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Shift not found"

# 5b. Reject shift closure with invalid JSON
POST http://localhost:8787/api/v1/eod/close
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "invalid_field": 100
}
HTTP 400
