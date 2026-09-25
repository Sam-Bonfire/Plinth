# Endpoint: POST /api/v1/refunds
# Verification: Refund recording with validation

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Negative: Zero amount rejected
POST {{base_url}}/api/v1/refunds
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
Authorization: Bearer {{token}}
{
  "order_id": "order-1",
  "amount_minor": 0,
  "reason": "Cold food"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_PAYLOAD"

# Negative: Unknown order rejected
POST {{base_url}}/api/v1/refunds
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
Authorization: Bearer {{token}}
{
  "order_id": "order-missing",
  "amount_minor": 500,
  "reason": "Cold food"
}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"

# Negative: Missing auth rejected
POST {{base_url}}/api/v1/refunds
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "order_id": "order-1",
  "amount_minor": 500,
  "reason": "Cold food"
}
HTTP 401
