# Endpoint: GET /api/v1/kds/tickets & POST /api/v1/kds/tickets/{id}/bump
# Verification: Kitchen ticket retrieval and station filtering

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234" }
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

# Positive: Create an order to generate a ticket and test bump endpoint
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "{{terminal_id}}",
  "table_id": "{{table_id}}",
  "seat_number": 1,
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Spicy",
      "seat_number": 1
    }
  ],
  "discounts": [],
  "charges": [],
  "tip": null
}
HTTP 201

# Fetch active tickets, restricted to Pending so the lifecycle starts from a fresh ticket
GET {{base_url}}/api/v1/kds/tickets?status=Pending
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Captures]
ticket_id: jsonpath "$[0].id"

# Illegal skip: bumping a Pending ticket fails with 409
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/bump
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "bumped_by": "{{staff_id}}"
}
HTTP 409

# Pending -> InPrep
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/start-prep
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.status" == "InPrep"

# Illegal skip: marking ready or bumping from InPrep is rejected
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/bump
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 409

# Repeating start-prep on an already-started ticket is illegal
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/start-prep
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 409

# InPrep -> Ready
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/mark-ready
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.status" == "Ready"

# Ready -> Bumped
POST {{base_url}}/api/v1/kds/tickets/{{ticket_id}}/bump
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "bumped_by": "{{staff_id}}"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "Bumped"

# Negative: Filter tickets by incorrect tenant_id (tenant-isolation)
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer {{token}}
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-location-id: {{location_id}}
HTTP 401
