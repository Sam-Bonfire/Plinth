# Health check probe
GET {{base_url}}/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger

# Negative Login: Missing x-tenant-id header
POST {{base_url}}/api/v1/auth/login
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 400
[Asserts]
jsonpath "$.error" contains "Missing x-tenant-id"

# Negative Login: Empty PIN rejected
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "   ", "role": "Owner" }
HTTP 400
[Asserts]
jsonpath "$.error" contains "PIN cannot be empty"

# Login Admin / Owner (Permissions: 1023)
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
header "Content-Type" contains "application/json"
jsonpath "$.token" isString
jsonpath "$.permissions" == 1023
[Captures]
token_admin: jsonpath "$.token"

# Login Cashier (Permissions: 513)
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "1234",
  "role": "Cashier"
}
HTTP 200
[Asserts]
jsonpath "$.token" isString
jsonpath "$.permissions" == 513
[Captures]
token_cashier: jsonpath "$.token"

# Login Waiter (Permissions: 1)
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "1234",
  "role": "Waiter"
}
HTTP 200
[Asserts]
jsonpath "$.token" isString
jsonpath "$.permissions" == 1
[Captures]
token_waiter: jsonpath "$.token"

# Missing all headers on protected endpoint
POST {{base_url}}/api/v1/orders
Content-Type: application/json
{ "channel": "DineIn", "terminal_id": "{{terminal_id}}", "items": [] }
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" isString

# Missing x-tenant-id header with valid bearer
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token_admin}}
x-location-id: {{location_id}}
HTTP 401

# Missing x-location-id header with valid bearer
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
HTTP 401

# Empty string tenant ID header
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token_admin}}
x-tenant-id: 
x-location-id: {{location_id}}
HTTP 401

# Invalid UUID format in x-tenant-id header
GET {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: not-a-valid-uuid-format
x-location-id: {{location_id}}
HTTP 401

# Malformed Authorization header missing 'Bearer ' prefix
GET {{base_url}}/api/v1/kds/tickets
Authorization: Basic dXNlcjpwYXNz
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401

# Corrupted / truncated JWT token
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corruptedpayload
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401

# Cross-tenant spoofing attempt: Token claims tenant_id, header specifies wrong tenant
GET {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: 00000000-0000-0000-0000-000000000099
x-location-id: {{location_id}}
HTTP 401
[Asserts]
jsonpath "$.error" contains "Tenant ID mismatch"

# RBAC: Cashier without OPEN_CLOSE_SHIFT permission attempting EOD closure
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token_cashier}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
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
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "is_available": false, "reason": "Unauthorized" }
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# RBAC: Staff without ACCESS_REPORTS permission attempting sales reports
GET {{base_url}}/api/v1/reports/sales?period=today
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"
