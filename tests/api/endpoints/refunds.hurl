# Endpoint: POST /api/v1/refunds + /{id}/approve + /{id}/process
# Verification: Refund requests start Pending and only a manager can walk them
#               Pending -> Approved -> Processed; skips are rejected.

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234" }
HTTP 200
[Captures]
token: cookie "plinth_access"

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

# Negative: Refund larger than the order total is capped
POST {{base_url}}/api/v1/refunds
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
Authorization: Bearer {{token}}
{
  "order_id": "00000000-0000-0000-0000-000000000006",
  "amount_minor": 999999,
  "reason": "Whole order"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_PAYLOAD"
jsonpath "$.error" contains "exceeds the order total"

# Positive: A refund request starts Pending
POST {{base_url}}/api/v1/refunds
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
Authorization: Bearer {{token}}
{
  "order_id": "00000000-0000-0000-0000-000000000006",
  "amount_minor": 1000,
  "reason": "Cold food"
}
HTTP 201
[Captures]
refund_id: jsonpath "$.refund_id"
[Asserts]
jsonpath "$.status" == "Pending"

# Negative: Processing before approval is an illegal skip
POST {{base_url}}/api/v1/refunds/{{refund_id}}/process
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 409
[Asserts]
jsonpath "$.code" == "CONFLICT"

# Positive: Pending -> Approved
POST {{base_url}}/api/v1/refunds/{{refund_id}}/approve
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "Approved"

# Negative: Approving twice is an illegal skip
POST {{base_url}}/api/v1/refunds/{{refund_id}}/approve
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 409

# Positive: Approved -> Processed
POST {{base_url}}/api/v1/refunds/{{refund_id}}/process
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "Processed"

# Negative: A processed refund is terminal
POST {{base_url}}/api/v1/refunds/{{refund_id}}/process
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 409

# The gateway stub is recorded in the audit trail
GET {{base_url}}/api/v1/audit?limit=10
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.events[?(@.action == 'REFUND_GATEWAY_STUB')]" isCollection

# Negative: Approving an unknown refund returns 404
POST {{base_url}}/api/v1/refunds/00000000-0000-0000-0000-000000000099/approve
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 404

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
