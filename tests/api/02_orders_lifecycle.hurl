# -------------------------------------------------------------
# PlinthOS API Test Suite: 02 Orders Lifecycle Matrix
# -------------------------------------------------------------

# 1. Fetch Menu Catalog
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# 2. Create New Dine-In Order
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "term-test-01",
  "table_id": "table-4",
  "seat_number": 2,
  "items": [
    {
      "menu_item_id": "item-butter-chicken",
      "name": "Butter Chicken",
      "unit_price_minor": 45000,
      "quantity": 2,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Extra spicy",
      "seat_number": 2
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
[Captures]
created_order_id: jsonpath "$.order.id"

# 3. Query Orders Summary List
GET http://localhost:8787/api/v1/orders?status=Confirmed&channel=DineIn&page=1&page_size=10
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.page" == 1
jsonpath "$.data" isCollection
