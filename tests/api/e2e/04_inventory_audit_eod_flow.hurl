# ==============================================================================
# E2E FLOW 04: Inventory Management, Audit Trail & End-Of-Day (EOD) Analytics
# ==============================================================================

# Authenticate Admin user
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "1234",
  "role": "Owner"
}
HTTP 200
[Asserts]
jsonpath "$.token" isString
[Captures]
token_admin: jsonpath "$.token"

# Query all inventory items
GET {{base_url}}/api/v1/inventory
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# Filter: is_active == true
GET {{base_url}}/api/v1/inventory?is_active=true
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Filter: below_reorder == true
GET {{base_url}}/api/v1/inventory?below_reorder=true
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Filter: unit == Kilogram
GET {{base_url}}/api/v1/inventory?unit=Kilogram
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Filter: unit == Litre
GET {{base_url}}/api/v1/inventory?unit=Litre
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Negative: Stock adjustment on non-existent stock item returns 404
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000099",
  "delta": "10.0",
  "reason": "PurchaseReceived"
}
HTTP 404
[Asserts]
jsonpath "$.error" contains "Not Found"

# Negative: Stock adjustment with invalid non-decimal delta string returns 400
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000010",
  "delta": "not-a-number-string",
  "reason": "PurchaseReceived"
}
HTTP 400

# Negative: Stock adjustment with invalid adjustment reason enum returns 400
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000010",
  "delta": "5.0",
  "reason": "InvalidReasonEnum"
}
HTTP 400

# Negative: Stock adjustment with empty body returns 400
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400

# Ingest PRICE_OVERRIDE audit log
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "PRICE_OVERRIDE",
  "target_type": "OrderLineItem",
  "target_id": "00000000-0000-0000-0000-000000000011",
  "payload_json": "{\"old_price\":45000,\"new_price\":35000}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.event_id" isString

# Ingest MANAGER_VOID audit log
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "MANAGER_VOID",
  "target_type": "Order",
  "target_id": "00000000-0000-0000-0000-000000000012",
  "payload_json": "{\"reason\":\"Customer left without ordering\"}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# Ingest CASH_DRAWER_NO_SALE_OPEN flagged as anomaly
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "CASH_DRAWER_NO_SALE_OPEN",
  "target_type": "StoreShift",
  "target_id": "00000000-0000-0000-0000-000000000015",
  "payload_json": "{\"reason\":\"Manual till opening without sale\"}",
  "is_anomaly": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# Negative: Audit ingestion with empty payload returns 400
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Sales Analytics: period == today
GET {{base_url}}/api/v1/reports/sales?period=today
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger
jsonpath "$.tax_liability_minor" isInteger

# Sales Analytics: period == yesterday
GET {{base_url}}/api/v1/reports/sales?period=yesterday
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger

# Sales Analytics: custom date range
GET {{base_url}}/api/v1/reports/sales?date_from=2026-08-01T00:00:00Z&date_to=2026-08-28T23:59:59Z
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.total_revenue_minor" isInteger

# Boundary: Sales Analytics fallback on invalid period string
GET {{base_url}}/api/v1/reports/sales?period=unknown_custom_period
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.total_revenue_minor" isInteger

# Negative: EOD close on non-existent shift ID returns 404
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "shift_id": "00000000-0000-0000-0000-000000000099",
  "physical_cash_minor": 50000,
  "notes": "Safe balance"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Shift not found"

# Negative: EOD close with empty JSON body returns 400
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"
