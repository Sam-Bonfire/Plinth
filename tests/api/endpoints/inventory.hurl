# Endpoint: GET /api/v1/inventory & POST /api/v1/inventory/adjust
# Verification: Inventory stock retrieval and adjustment contracts

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# List stock items
GET {{base_url}}/api/v1/inventory
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# Filter by active status
GET {{base_url}}/api/v1/inventory?is_active=true
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Negative: Adjust non-existent stock item returns 404
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000099",
  "delta": "5.0",
  "reason": "PurchaseReceived"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Not Found"

# Positive: Adjust an existing stock item
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000010",
  "delta": "5.0",
  "reason": "PurchaseReceived"
}
HTTP 200
[Asserts]
jsonpath "$.item.id" == "00000000-0000-0000-0000-000000000010"

# Negative: Adjust a stock item with incorrect tenant_id (tenant-isolation)
POST {{base_url}}/api/v1/inventory/adjust
Authorization: Bearer {{token}}
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-location-id: {{location_id}}
Content-Type: application/json
{
  "stock_item_id": "00000000-0000-0000-0000-000000000010",
  "delta": "5.0",
  "reason": "PurchaseReceived"
}
HTTP 401

# Negative: Retrieve inventory with incorrect tenant_id (tenant-isolation)
GET {{base_url}}/api/v1/inventory
Authorization: Bearer {{token}}
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-location-id: {{location_id}}
HTTP 401
