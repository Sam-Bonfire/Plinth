# ==============================================================================
# E2E FLOW 02: Menu Catalog, Categorization & 86 Item Availability Lifecycle
# ==============================================================================

# Authenticate Admin / Manager
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

# Fetch full multi-tenant menu catalog
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# Negative: 86 toggle on non-existent item UUID returns 404
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000999/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": false,
  "reason": "Non-existent item"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Menu item not found"

# Negative: 86 toggle with empty payload returns 400
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Negative: 86 toggle with invalid string boolean value returns 400
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": "not_available"
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Positive: 86 an item out of stock
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": false,
  "reason": "Sold out during lunch rush"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == false

# Positive: Restore item availability back to in-stock
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": true,
  "reason": "Fresh batch prepared by kitchen"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == true
