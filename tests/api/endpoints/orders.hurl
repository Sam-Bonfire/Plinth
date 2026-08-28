# Endpoint: POST /api/v1/orders & GET /api/v1/orders
# Verification: Order creation and listing with pagination

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Positive: Create a valid DineIn order
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
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.order.id" isString
jsonpath "$.order.status" == "Confirmed"
jsonpath "$.order.channel" == "DineIn"

# Positive: List paginated orders
GET {{base_url}}/api/v1/orders?page=1&page_size=10
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.data" isCollection
jsonpath "$.page" == 1
jsonpath "$.page_size" == 10
jsonpath "$.total_records" isInteger

# Negative: Create order with invalid payload
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Invalid"
