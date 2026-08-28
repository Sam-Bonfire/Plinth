# =============================================================================
# PlinthOS API Test Suite: 01 Auth & Security Matrix
# Exhaustive Verification of Health, Authentication, Authorization & RBAC
# =============================================================================

# -----------------------------------------------------------------------------
# 1. Health Probe Verification
# -----------------------------------------------------------------------------
GET http://localhost:8787/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger

# -----------------------------------------------------------------------------
# 2. Authentication Rejection: Missing Credentials & Headers
# -----------------------------------------------------------------------------

# 2a. Reject Order Creation with zero headers
POST http://localhost:8787/api/v1/orders
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "term-test-01",
  "items": []
}
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.code" == "UNAUTHORIZED"
jsonpath "$.error" isString

# 2b. Reject Menu Catalog fetch with missing x-tenant-id
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_jwt_token_admin
x-location-id: loc-sample-01
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"

# 2c. Reject Menu Catalog fetch with missing x-location-id
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"

# 2d. Reject KDS tickets with malformed bearer token
GET http://localhost:8787/api/v1/kds/tickets
Authorization: Bearer malformed-garbage-token-abc
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"

# 2e. Reject Inventory inspection with missing Authorization header
GET http://localhost:8787/api/v1/inventory
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"

# -----------------------------------------------------------------------------
# 3. RBAC & Permission Enforcement Rejection
# -----------------------------------------------------------------------------

# 3a. Reject EOD Shift Closure if token lacks OPEN_CLOSE_SHIFT permission
POST http://localhost:8787/api/v1/eod/close
Authorization: Bearer test_jwt_token_cashier_no_shift_perm
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "shift_id": "shift-sample-99",
  "physical_cash_minor": 50000,
  "notes": "Attempt unauthorized close"
}
HTTP 403
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "permissions"

# 3b. Reject 86 Menu Item Toggle if token lacks MANAGE_MENU permission
PATCH http://localhost:8787/api/v1/menu/items/item-sample-01/availability
Authorization: Bearer test_jwt_token_waiter_no_menu_perm
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": false,
  "reason": "Unauthorized 86 toggle"
}
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"

# 3c. Reject Sales Reports Analytics if token lacks ACCESS_REPORTS permission
GET http://localhost:8787/api/v1/reports/sales?period=today
Authorization: Bearer test_jwt_token_waiter_no_menu_perm
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 403
[Asserts]
jsonpath "$.error" contains "permissions"
