# Fetch initial menu catalog
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# Negative: Reject empty JSON object
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Invalid"

# Negative: Reject invalid channel enum value
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "DriveThruInvalid",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "items": []
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Negative: Reject invalid tax rate enum value
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Item",
      "unit_price_minor": 10000,
      "quantity": 1,
      "tax_rate": "FiftyPercentInvalid",
      "modifiers": []
    }
  ]
}
HTTP 400

# Negative: Reject malformed UUID for terminal_id
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "Takeaway",
  "terminal_id": "not-a-valid-uuid",
  "items": []
}
HTTP 400

# Negative: Reject malformed UUID for menu_item_id
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "items": [
    {
      "menu_item_id": "invalid-menu-item-uuid",
      "name": "Item",
      "unit_price_minor": 10000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": []
    }
  ]
}
HTTP 400

# Adversarial: SQL Injection attempt in notes field is safely parameterized
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "table_id": "00000000-0000-0000-0000-000000000004",
  "seat_number": 1,
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "'; DROP TABLE orders; --",
      "seat_number": 1
    }
  ],
  "discounts": [],
  "charges": [],
  "tip": null
}
HTTP 201
[Asserts]
jsonpath "$.order.id" isString
jsonpath "$.order.items[0].notes" == "'; DROP TABLE orders; --"
[Captures]
sqli_order_id: jsonpath "$.order.id"

# Self-Seed DineIn Order: Table, Seat, Modifiers, 5% GST, Tip, Service Charge
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "table_id": "00000000-0000-0000-0000-000000000004",
  "seat_number": 2,
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000011",
      "name": "Butter Chicken",
      "unit_price_minor": 45000,
      "quantity": 2,
      "tax_rate": "FivePercent",
      "modifiers": [
        {
          "group_id": "00000000-0000-0000-0000-000000000020",
          "selected_options": ["00000000-0000-0000-0000-000000000021"],
          "special_instructions": "Extra spicy"
        }
      ],
      "notes": "Hot",
      "seat_number": 2
    }
  ],
  "discounts": [],
  "charges": [
    {
      "charge_type": "ServiceCharge",
      "rate": "5.0",
      "amount": { "amount": "45.00", "currency": "Inr" },
      "taxable": true
    }
  ],
  "tip": {
    "tip_type": { "Flat": { "amount": "50.00", "currency": "Inr" } },
    "computed_amount": { "amount": "50.00", "currency": "Inr" },
    "recipient": null
  }
}
HTTP 201
[Asserts]
jsonpath "$.order.status" == "Confirmed"
jsonpath "$.order.channel" == "DineIn"
[Captures]
seeded_dinein_id: jsonpath "$.order.id"

# Self-Seed Takeaway Order: Packaging Charge, 10% Discount, 18% GST
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "Takeaway",
  "terminal_id": "00000000-0000-0000-0000-000000000003",
  "table_id": null,
  "seat_number": null,
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000012",
      "name": "Virgin Mojito",
      "unit_price_minor": 18000,
      "quantity": 2,
      "tax_rate": "EighteenPercent",
      "modifiers": [],
      "notes": "Less sugar",
      "seat_number": null
    }
  ],
  "discounts": [
    {
      "discount_type": { "Percentage": "10.0" },
      "reason": "HappyHour",
      "authorized_by": null
    }
  ],
  "charges": [
    {
      "charge_type": "PackagingCharge",
      "rate": null,
      "amount": { "amount": "20.00", "currency": "Inr" },
      "taxable": false
    }
  ],
  "tip": null
}
HTTP 201
[Asserts]
jsonpath "$.order.channel" == "Takeaway"
[Captures]
seeded_takeaway_id: jsonpath "$.order.id"

# Self-Seed Swiggy Aggregator Order
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "channel": "Swiggy",
  "terminal_id": "00000000-0000-0000-0000-000000000005",
  "table_id": null,
  "seat_number": null,
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000013",
      "name": "Chicken Biryani",
      "unit_price_minor": 35000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Deliver fast",
      "seat_number": null
    }
  ],
  "discounts": [],
  "charges": [],
  "tip": null
}
HTTP 201
[Asserts]
jsonpath "$.order.channel" == "Swiggy"

# Query: List all orders
GET http://localhost:8787/api/v1/orders
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.total_records" >= 3

# Filter: status == Confirmed
GET http://localhost:8787/api/v1/orders?status=Confirmed
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# Filter: channel == DineIn
GET http://localhost:8787/api/v1/orders?channel=DineIn
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "DineIn"

# Filter: channel == Takeaway
GET http://localhost:8787/api/v1/orders?channel=Takeaway
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "Takeaway"

# Filter: channel == Swiggy
GET http://localhost:8787/api/v1/orders?channel=Swiggy
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "Swiggy"

# Filter: table_id filter
GET http://localhost:8787/api/v1/orders?table_id=00000000-0000-0000-0000-000000000004
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# Adversarial: SQL Injection in query params is safely handled
GET http://localhost:8787/api/v1/orders?status=Confirmed'%20OR%20'1'='1
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.total_records" == 0

# Boundary: page=0 saturates cleanly to page 1
GET http://localhost:8787/api/v1/orders?page=0&page_size=2
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.page" == 0
jsonpath "$.page_size" == 2

# Boundary: page_size=1000 is capped to max 100
GET http://localhost:8787/api/v1/orders?page=1&page_size=1000
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.page_size" == 100

# Boundary: page=99999 out of range returns empty list
GET http://localhost:8787/api/v1/orders?page=99999&page_size=10
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$.data" count == 0
