# Endpoint: GET /api/v1/kds/tickets & POST /api/v1/kds/tickets/{id}/bump
# Verification: Kitchen ticket retrieval and station filtering

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# List all active kitchen tickets
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# Filter tickets by Grill station
GET {{base_url}}/api/v1/kds/tickets?station=Grill
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Negative: Bump non-existent ticket returns 404
POST {{base_url}}/api/v1/kds/tickets/00000000-0000-0000-0000-000000000099/bump
Authorization: Bearer {{token}}
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
