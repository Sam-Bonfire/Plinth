# =============================================================================
# PlinthOS API Test Suite: 02 Orders Lifecycle & Self-Seeding Matrix
# Exhaustive Creation Across Channels, Modifiers, Taxes, Charges & Filtering
# =============================================================================

# -----------------------------------------------------------------------------
# 1. Fetch Menu Catalog Before Ordering
# -----------------------------------------------------------------------------
GET http://localhost:8787/api/v1/menu
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# -----------------------------------------------------------------------------
# 2. Self-Seed Orders Across Multiple Channels & Configurations
# -----------------------------------------------------------------------------

# 2a. Scenario A: Dine-In Order (Table 4, Seat 2, Modifiers, 5% GST, Flat Tip)
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "term-pos-01",
  "table_id": "table-4",
  "seat_number": 2,
  "items": [
    {
      "menu_item_id": "item-butter-chicken-01",
      "name": "Butter Chicken",
      "unit_price_minor": 45000,
      "quantity": 2,
      "tax_rate": "FivePercent",
      "modifiers": [
        {
          "group_id": "mod-spice-level",
          "selected_options": ["opt-spice-medium"],
          "special_instructions": "Less butter"
        }
      ],
      "notes": "Serve with hot butter naan",
      "seat_number": 2
    },
    {
      "menu_item_id": "item-garlic-naan-02",
      "name": "Garlic Naan",
      "unit_price_minor": 8000,
      "quantity": 4,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Crispy",
      "seat_number": 2
    }
  ],
  "discounts": [],
  "charges": [
    {
      "charge_type": "ServiceCharge",
      "rate": "5.0",
      "amount": { "amount": "61.00", "currency": "Inr" },
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
header "Content-Type" contains "application/json"
jsonpath "$.order.id" isString
jsonpath "$.order.status" == "Confirmed"
jsonpath "$.order.channel" == "DineIn"
jsonpath "$.order.table_id" == "table-4"
jsonpath "$.order.items" count == 2
[Captures]
dinein_order_id: jsonpath "$.order.id"

# 2b. Scenario B: Takeaway Order (Packaging Charge, 10% Discount, 18% GST)
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "channel": "Takeaway",
  "terminal_id": "term-pos-02",
  "table_id": null,
  "seat_number": null,
  "items": [
    {
      "menu_item_id": "item-mocktail-blue-03",
      "name": "Blue Lagoon Mocktail",
      "unit_price_minor": 22000,
      "quantity": 3,
      "tax_rate": "EighteenPercent",
      "modifiers": [],
      "notes": "Extra ice in separate cup",
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
      "amount": { "amount": "30.00", "currency": "Inr" },
      "taxable": false
    }
  ],
  "tip": null
}
HTTP 201
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.order.channel" == "Takeaway"
jsonpath "$.order.items" count == 1
[Captures]
takeaway_order_id: jsonpath "$.order.id"

# 2c. Scenario C: Swiggy Aggregator Order (Zero Tip, Swiggy Channel)
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "channel": "Swiggy",
  "terminal_id": "term-aggregator-01",
  "table_id": null,
  "seat_number": null,
  "items": [
    {
      "menu_item_id": "item-biryani-box-04",
      "name": "Chicken Dum Biryani",
      "unit_price_minor": 38000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Include extra salan and raita",
      "seat_number": null
    }
  ],
  "discounts": [],
  "charges": [
    {
      "charge_type": "DeliveryCharge",
      "rate": null,
      "amount": { "amount": "40.00", "currency": "Inr" },
      "taxable": false
    }
  ],
  "tip": null
}
HTTP 201
[Asserts]
jsonpath "$.order.channel" == "Swiggy"
[Captures]
swiggy_order_id: jsonpath "$.order.id"

# 2d. Scenario D: Zomato Aggregator Order
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "channel": "Zomato",
  "terminal_id": "term-aggregator-02",
  "table_id": null,
  "seat_number": null,
  "items": [
    {
      "menu_item_id": "item-tandoori-platter-05",
      "name": "Assorted Tandoori Kebab Platter",
      "unit_price_minor": 65000,
      "quantity": 1,
      "tax_rate": "FivePercent",
      "modifiers": [],
      "notes": "Mint chutney and onion rings",
      "seat_number": null
    }
  ],
  "discounts": [],
  "charges": [],
  "tip": null
}
HTTP 201
[Asserts]
jsonpath "$.order.channel" == "Zomato"
[Captures]
zomato_order_id: jsonpath "$.order.id"

# 2e. Scenario E: Rejection of Invalid Payload
POST http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "invalid_key": true
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Invalid"

# -----------------------------------------------------------------------------
# 3. Exhaustive Order List & Query Parameter Filtering
# -----------------------------------------------------------------------------

# 3a. Query all orders (default pagination)
GET http://localhost:8787/api/v1/orders
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.page" == 1
jsonpath "$.data" isCollection

# 3b. Filter by status == Confirmed
GET http://localhost:8787/api/v1/orders?status=Confirmed
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3c. Filter by channel == DineIn
GET http://localhost:8787/api/v1/orders?channel=DineIn
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3d. Filter by channel == Takeaway
GET http://localhost:8787/api/v1/orders?channel=Takeaway
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3e. Filter by channel == Swiggy
GET http://localhost:8787/api/v1/orders?channel=Swiggy
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3f. Filter by terminal_id
GET http://localhost:8787/api/v1/orders?terminal_id=term-pos-01
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3g. Filter by table_id
GET http://localhost:8787/api/v1/orders?table_id=table-4
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# 3h. Pagination check: page=1&page_size=2
GET http://localhost:8787/api/v1/orders?page=1&page_size=2
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.page" == 1
jsonpath "$.page_size" == 2
jsonpath "$.data" isCollection

# 3i. Pagination check: page=2&page_size=2
GET http://localhost:8787/api/v1/orders?page=2&page_size=2
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
jsonpath "$.page" == 2
jsonpath "$.page_size" == 2
