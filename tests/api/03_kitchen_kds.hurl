# =============================================================================
# PlinthOS API Test Suite: 03 Kitchen & KDS Operations Matrix
# Exhaustive Station Routing, Lifecycle Bumps & Menu 86 Toggling
# =============================================================================

# -----------------------------------------------------------------------------
# 1. KDS Station Ticket Querying & Filtering
# -----------------------------------------------------------------------------

# 1a. Query all active KDS tickets (default: Pending, InPrep, Ready)
GET http://localhost:8787/api/v1/kds/tickets
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# 1b. Query tickets routed to Grill station
GET http://localhost:8787/api/v1/kds/tickets?station=Grill
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1c. Query tickets routed to Tandoor station
GET http://localhost:8787/api/v1/kds/tickets?station=Tandoor
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1d. Query tickets routed to Beverages station
GET http://localhost:8787/api/v1/kds/tickets?station=Beverages
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1e. Query tickets routed to MainKitchen station
GET http://localhost:8787/api/v1/kds/tickets?station=MainKitchen
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1f. Query tickets filtered by status == Pending
GET http://localhost:8787/api/v1/kds/tickets?status=Pending
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1g. Query tickets filtered by status == InPrep
GET http://localhost:8787/api/v1/kds/tickets?status=InPrep
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1h. Query tickets filtered by status == Ready
GET http://localhost:8787/api/v1/kds/tickets?status=Ready
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# 1i. Query tickets filtered by station AND status combined
GET http://localhost:8787/api/v1/kds/tickets?station=Grill&status=Pending
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$" isCollection

# -----------------------------------------------------------------------------
# 2. Ticket Bumping & Error Conditions
# -----------------------------------------------------------------------------

# 2a. Reject bump on non-existent ticket ID
POST http://localhost:8787/api/v1/kds/tickets/non-existent-ticket-uuid-99/bump
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "bumped_by": "staff-head-chef-01"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "not found"

# -----------------------------------------------------------------------------
# 3. Menu Item 86 Availability Toggling Matrix
# -----------------------------------------------------------------------------

# 3a. Mark menu item as 86 (unavailable)
PATCH http://localhost:8787/api/v1/menu/items/item-butter-chicken-01/availability
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": false,
  "reason": "86 item: sold out during dinner rush"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == false
jsonpath "$.id" == "item-butter-chicken-01"

# 3b. Verify catalog reflects unavailable state
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.categories" isCollection

# 3c. Restore menu item availability (un-86)
PATCH http://localhost:8787/api/v1/menu/items/item-butter-chicken-01/availability
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": true,
  "reason": "Fresh batch prepared by chef"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == true

# 3d. Reject 86 toggle on non-existent item ID
PATCH http://localhost:8787/api/v1/menu/items/ghost-item-uuid-9999/availability
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": false,
  "reason": "Does not exist"
}
HTTP 404
[Asserts]
jsonpath "$.error" contains "not found"

# 3e. Reject 86 toggle with malformed JSON body
PATCH http://localhost:8787/api/v1/menu/items/item-butter-chicken-01/availability
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": "invalid-boolean-string"
}
HTTP 400
