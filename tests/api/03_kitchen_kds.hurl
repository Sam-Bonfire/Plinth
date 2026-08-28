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

# Query active KDS tickets
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# Query tickets by Grill station
GET {{base_url}}/api/v1/kds/tickets?station=Grill
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by Tandoor station
GET {{base_url}}/api/v1/kds/tickets?station=Tandoor
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by Beverages station
GET {{base_url}}/api/v1/kds/tickets?station=Beverages
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by status == Pending
GET {{base_url}}/api/v1/kds/tickets?status=Pending
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by status == Ready
GET {{base_url}}/api/v1/kds/tickets?status=Ready
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Combined filter: station AND status
GET {{base_url}}/api/v1/kds/tickets?station=Grill&status=Pending
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Adversarial: SQL Injection in station query param is safely bound
GET {{base_url}}/api/v1/kds/tickets?station=Grill'%20UNION%20SELECT%201,2,3--
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 0

# Negative: Bump non-existent ticket returns 404
POST {{base_url}}/api/v1/kds/tickets/00000000-0000-0000-0000-000000000099/bump
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "bumped_by": "{{staff_id}}"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Ticket not found"

# Negative: 86 toggle with non-existent item UUID returns 404
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000999/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": false,
  "reason": "Ghost item"
}
HTTP 404
[Asserts]
jsonpath "$.error" contains "Menu item not found"

# Negative: 86 toggle with invalid string boolean returns 400
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "is_available": "no_longer_available"
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Negative: 86 toggle with empty body returns 400
PATCH {{base_url}}/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
