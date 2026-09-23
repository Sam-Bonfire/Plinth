# Endpoint: POST /api/v1/public/orders
# Verification: Public aggregator order submission with KDS dispatch

# Positive: Submit a Swiggy order
POST {{base_url}}/api/v1/public/orders
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "location_id": "{{location_id}}",
  "channel": "Swiggy",
  "customer_name": "Guest",
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1
    }
  ]
}
HTTP 201
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.order_id" isString
jsonpath "$.ticket_id" isString
jsonpath "$.total_minor" == 32000

# Negative: Unknown channel rejected
POST {{base_url}}/api/v1/public/orders
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "location_id": "{{location_id}}",
  "channel": "DineIn",
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1
    }
  ]
}
HTTP 400

# Negative: Empty items rejected
POST {{base_url}}/api/v1/public/orders
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "location_id": "{{location_id}}",
  "channel": "Zomato",
  "items": []
}
HTTP 400

# Negative: Bad tenant rejected
POST {{base_url}}/api/v1/public/orders
Content-Type: application/json
{
  "tenant_id": "not-a-uuid",
  "location_id": "{{location_id}}",
  "channel": "Zomato",
  "items": [
    {
      "menu_item_id": "00000000-0000-0000-0000-000000000010",
      "name": "Paneer Tikka",
      "unit_price_minor": 32000,
      "quantity": 1
    }
  ]
}
HTTP 400
