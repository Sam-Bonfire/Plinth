# Endpoint: GET /api/v1/public/orders/:id/status
# Verification: Public order status lookup (no auth)

# Unknown order id
GET {{base_url}}/api/v1/public/orders/order-missing/status
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"
