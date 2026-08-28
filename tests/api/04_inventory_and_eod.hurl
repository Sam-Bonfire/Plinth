# -------------------------------------------------------------
# PlinthOS API Test Suite: 04 Inventory, Audit & EOD Closure
# -------------------------------------------------------------

# 1. Query Inventory Stock Items
GET http://localhost:8787/api/v1/inventory?is_active=true
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# 2. Ingest Audit Event Log
POST http://localhost:8787/api/v1/audit
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "action": "MANAGER_VOID",
  "target_type": "Order",
  "target_id": "ord-test-01",
  "payload_json": "{\"reason\": \"Guest requested cancellation\"}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.event_id" isString

# 3. Query Sales Report
GET http://localhost:8787/api/v1/reports/sales?period=today
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger
