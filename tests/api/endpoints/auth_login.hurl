# Endpoint: POST /api/v1/auth/login
# Verification: Staff PIN authentication and JWT issuance

# Positive: Authenticate staff with PIN
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
header "Content-Type" contains "application/json"
jsonpath "$.token" isString
jsonpath "$.staff_id" isString
jsonpath "$.role" isString
jsonpath "$.permissions" isInteger
jsonpath "$.expires_in" isInteger

# Negative: Missing x-tenant-id header
POST {{base_url}}/api/v1/auth/login
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": "1234"
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Missing x-tenant-id"

# Negative: Empty PIN
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "staff_id": "{{staff_id}}",
  "pin": ""
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "PIN cannot be empty"
