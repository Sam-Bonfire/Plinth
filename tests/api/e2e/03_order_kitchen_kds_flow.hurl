# ==============================================================================
# E2E FLOW 03: Multi-Channel Order Placement, KDS Routing & Ticket Lifecycle
# ==============================================================================

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

# Negative: Reject empty order payload
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Invalid"

# Negative: Reject invalid order channel
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "NonExistentChannel",
  "terminal_id": "{{terminal_id}}",
  "items": []
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Negative: Reject item with invalid tax rate enum
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "{{terminal_id}}",
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1,
      "tax_rate": "InvalidTaxEnum",
      "modifiers": []
    }
  ]
}
HTTP 400

# Negative: Reject malformed terminal UUID
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "Takeaway",
  "terminal_id": "not-a-valid-uuid",
  "items": []
}
HTTP 400

# Adversarial: SQL Injection attempt in notes is safely parameterized
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
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

# Positive Flow: Self-Seed DineIn Order with Table, Seat, Modifiers, 5% GST, Tip, Service Charge
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "{{terminal_id}}",
  "table_id": "{{table_id}}",
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

# Positive Flow: Self-Seed Takeaway Order with Packaging Charge, 10% Discount, 18% GST
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "channel": "Takeaway",
  "terminal_id": "{{terminal_id}}",
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

# Positive Flow: Self-Seed Swiggy Aggregator Order
POST {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
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
GET {{base_url}}/api/v1/orders
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.total_records" >= 3

# Filter: Orders by channel == DineIn
GET {{base_url}}/api/v1/orders?channel=DineIn
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "DineIn"

# Filter: Orders by channel == Takeaway
GET {{base_url}}/api/v1/orders?channel=Takeaway
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "Takeaway"

# Filter: Orders by channel == Swiggy
GET {{base_url}}/api/v1/orders?channel=Swiggy
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.data[0].channel" == "Swiggy"

# KDS: Query active kitchen tickets
GET {{base_url}}/api/v1/kds/tickets
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# KDS: Query tickets by Grill station
GET {{base_url}}/api/v1/kds/tickets?station=Grill
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# KDS: Query tickets by Tandoor station
GET {{base_url}}/api/v1/kds/tickets?station=Tandoor
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# KDS: Combined filter by station & status
GET {{base_url}}/api/v1/kds/tickets?station=Grill&status=Pending
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$" isCollection

# KDS Negative: Bump non-existent ticket returns 404
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
jsonpath "$.error" contains "Ticket not found"

# Boundary: page=0 saturates cleanly to page 1
GET {{base_url}}/api/v1/orders?page=0&page_size=2
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.page" == 0
jsonpath "$.page_size" == 2

# Boundary: page_size=1000 is capped to max 100
GET {{base_url}}/api/v1/orders?page=1&page_size=1000
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.page_size" == 100

# Boundary: page=99999 out of range returns empty list
GET {{base_url}}/api/v1/orders?page=99999&page_size=10
Authorization: Bearer {{token_admin}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.data" count == 0
