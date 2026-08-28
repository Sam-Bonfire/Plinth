# ==============================================================================
# E2E FLOW 01: Multi-Tenant Staff Authentication & RBAC Permission Matrix
# ==============================================================================

# Health check probe
GET {{base_url}}/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger

# Negative Case: Login attempt without tenant header
POST {{base_url}}/api/v1/auth/login
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "1234",
  "role": "Owner"
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Missing x-tenant-id"

# Negative Case: Login attempt with empty PIN
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "   ",
  "role": "Owner"
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "PIN cannot be empty"

# Positive Case: Login Owner / Admin (Permissions bitmask: 1023)
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
jsonpath "$.role" == "Owner"
jsonpath "$.permissions" == 1023
jsonpath "$.expires_in" >= 3600
[Captures]
token_admin: jsonpath "$.token"

# Positive Case: Login Cashier (Permissions bitmask: 513)
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
jsonpath "$.role" == "Cashier"
jsonpath "$.permissions" == 513
[Captures]
token_cashier: jsonpath "$.token"

# Positive Case: Login Waiter (Permissions bitmask: 1)
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
jsonpath "$.role" == "Waiter"
jsonpath "$.permissions" == 1
[Captures]
token_waiter: jsonpath "$.token"

# Adversarial: Unauthenticated request missing all headers
POST {{base_url}}/api/v1/orders
Content-Type: application/json
{ "channel": "DineIn", "terminal_id": "{{terminal_id}}", "items": [] }
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" isString

# Adversarial: Header specifies valid token but missing tenant context
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token_admin}}
x-location-id: {{location_id}}
HTTP 401
[Asserts]
jsonpath "$.error" contains "Missing x-tenant-id"

# Adversarial: Corrupted / spoofed token payload
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer corrupted.payload.header
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401

# Cross-Tenant Spoofing: Token issued for Tenant A used against Tenant B
GET {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: 00000000-0000-0000-0000-000000000099
x-location-id: {{location_id}}
HTTP 401
[Asserts]
jsonpath "$.error" contains "Tenant ID mismatch"

# RBAC Violation: Cashier attempting shift close without supervisor permissions
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token_cashier}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "shift_id": "00000000-0000-0000-0000-000000000099",
  "physical_cash_minor": 50000,
  "notes": "Unauthorized cashier attempt"
}
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# RBAC Violation: Waiter attempting 86 item catalog toggle without MANAGE_MENU
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "is_available": false, "reason": "Unauthorized" }
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# RBAC Violation: Waiter attempting to view sales financials without ACCESS_REPORTS
GET {{base_url}}/api/v1/reports/sales?period=today
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"
