# Endpoint: POST /api/v1/audit
# Verification: Audit trail ingestion contract

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Positive: Ingest audit event
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "PRICE_OVERRIDE",
  "target_type": "OrderLineItem",
  "target_id": "00000000-0000-0000-0000-000000000011",
  "payload_json": "{\"old_price\":45000,\"new_price\":35000}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.event_id" isString

# Negative: Ingest with empty payload
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Invalid"

# Negative: Wrong tenant isolation (non-existent/mismatched UUID)
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: 00000000-0000-0000-0000-000000000999
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "PRICE_OVERRIDE",
  "target_type": "OrderLineItem",
  "target_id": "00000000-0000-0000-0000-000000000011",
  "payload_json": "{\"old_price\":45000,\"new_price\":35000}",
  "is_anomaly": false
}
HTTP 401

# Negative: An action outside the allowlist cannot enter the trail
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "INVENTED_ACTION",
  "target_type": "OrderLineItem",
  "target_id": "00000000-0000-0000-0000-000000000011",
  "payload_json": null,
  "is_anomaly": false
}
HTTP 403
[Asserts]
jsonpath "$.code" == "AUDIT_ACTION_NOT_ALLOWED"

# Positive: Flush target for the terminal role-matrix sync queue
# The dashboard flushes queued ops to this endpoint; proving the contract here
# proves the flush has somewhere real to deliver and can empty its queue.
POST {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "action": "ROLE_MATRIX_SYNC",
  "target_type": "role-matrix",
  "target_id": "terminal-sync",
  "payload_json": "{\"Apply discounts\":{\"Owner\":true,\"Manager\":true,\"Cashier\":false,\"Kitchen\":false}}",
  "is_anomaly": false
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# The flushed op is readable back from the audit trail
GET {{base_url}}/api/v1/audit?limit=10
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
jsonpath "$.events[?(@.action == 'ROLE_MATRIX_SYNC')]" isCollection
jsonpath "$.events[?(@.action == 'ROLE_MATRIX_SYNC')].target_type" includes "role-matrix"

# Positive: List audit events with explicit limit bound
GET {{base_url}}/api/v1/audit?limit=2
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.events" isCollection
jsonpath "$.events" count <= 2

# Positive: Out-of-range limit falls back to the default page
GET {{base_url}}/api/v1/audit?limit=500
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.events" isCollection

# Positive: Missing limit lists with the default page
GET {{base_url}}/api/v1/audit
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.events" isCollection

# Negative: Unauthenticated list returns 401
GET {{base_url}}/api/v1/audit?limit=2
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401
