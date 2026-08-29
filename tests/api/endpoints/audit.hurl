# Endpoint: POST /api/v1/audit
# Verification: Audit trail ingestion contract

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
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
