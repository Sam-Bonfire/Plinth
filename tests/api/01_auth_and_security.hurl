# Health check probe
GET http://localhost:8787/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger

# Missing all headers on protected endpoint
POST http://localhost:8787/api/v1/orders
Content-Type: application/json
{ "channel": "DineIn", "terminal_id": "term-01", "items": [] }
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" isString

# Missing x-tenant-id header
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_token
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"

# Missing x-location-id header
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_token
x-tenant-id: 00000000-0000-0000-0000-000000000001
HTTP 401

# Empty string tenant ID header
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_token
x-tenant-id: 
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401

# Invalid UUID format in x-tenant-id header
GET http://localhost:8787/api/v1/orders
Authorization: Bearer test_token
x-tenant-id: not-a-valid-uuid-format
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401

# Malformed Authorization header missing 'Bearer ' prefix
GET http://localhost:8787/api/v1/kds/tickets
Authorization: Basic dXNlcjpwYXNz
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401

# Corrupted / truncated JWT token
GET http://localhost:8787/api/v1/kds/tickets
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corruptedpayload
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401

# Cross-tenant spoofing attempt: JWT claims tenant A, header specifies tenant B
GET http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_tenant_a
x-tenant-id: 00000000-0000-0000-0000-000000000002
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 401

# RBAC: Cashier without OPEN_CLOSE_SHIFT permission attempting EOD closure
POST http://localhost:8787/api/v1/eod/close
Authorization: Bearer test_token_cashier
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "shift_id": "00000000-0000-0000-0000-000000000099",
  "physical_cash_minor": 50000,
  "notes": "Unauthorized closure"
}
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# RBAC: Waiter without MANAGE_MENU permission attempting 86 item toggle
PATCH http://localhost:8787/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer test_token_waiter
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{ "is_available": false, "reason": "Unauthorized" }
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# RBAC: Staff without ACCESS_REPORTS permission attempting sales reports
GET http://localhost:8787/api/v1/reports/sales?period=today
Authorization: Bearer test_token_waiter
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"
