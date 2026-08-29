# Endpoint: GET /api/v1/menu & PATCH /api/v1/menu/items/{id}/availability
# Verification: Catalog retrieval and item availability toggle

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Retrieve full menu catalog
GET {{base_url}}/api/v1/menu
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# Positive: Toggle item availability
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": false,
  "reason": "Test 86 toggle"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == false

# Negative: Toggle non-existent item UUID
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000999/availability
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": false
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Menu item not found"
