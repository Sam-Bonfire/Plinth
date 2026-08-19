# Submit Order Payload to Local Edge Worker Simulator
POST http://localhost:8787/api/v1/orders
Header "Content-Type: application/json"
Header "X-Store-Id: store_loc_99"
Header "Authorization: Bearer test_jwt_token_admin"
{
  "order_id": "ord_100982",
  "table_id": "T-04",
  "items": [
    {
      "item_id": "m1_butter_chicken",
      "quantity": 2,
      "price_cents": 34000,
      "modifiers": ["Medium Spicy"]
    }
  ],
  "tender": {
    "type": "CARD",
    "amount_cents": 68000
  }
}

# Assertions
HTTP 201
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "SUCCESS"
jsonpath "$.data.order_id" == "ord_100982"
jsonpath "$.data.total_cents" == 71400  # 68000 + 5% tax (3400)
jsonpath "$.data.sync_status" == "SETTLED"
