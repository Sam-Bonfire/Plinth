# Endpoint: GET /api/v1/public/orders/:id/status
# Verification: Public order status lookup, tenant-scoped (no auth)

# Missing tenant scope rejected
GET {{base_url}}/api/v1/public/orders/order-missing/status
HTTP 400
[Asserts]
jsonpath "$.code" == "BAD_REQUEST"

# Unknown order id (uniform with out-of-scope ids)
GET {{base_url}}/api/v1/public/orders/order-missing/status?tenant_id={{tenant_id}}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"
