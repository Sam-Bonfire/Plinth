# Endpoint: POST /api/v1/eod/open + POST /api/v1/eod/close
# Verification: End of Day shift open/closure contracts

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Negative: Empty open payload returns 400
POST {{base_url}}/api/v1/eod/open
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400

# Positive: Open a new shift returns its id
POST {{base_url}}/api/v1/eod/open
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "opening_float_minor": 20000,
  "terminal_id": null
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.shift_id" exists
[Captures]
shift_id: jsonpath "$.shift_id"

# Negative: Opening a second shift while one is open returns 409
POST {{base_url}}/api/v1/eod/open
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "opening_float_minor": 20000,
  "terminal_id": null
}
HTTP 409

# Negative: Close non-existent shift ID returns 404
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "shift_id": "00000000-0000-0000-0000-000000000099",
  "physical_cash_minor": 50000,
  "notes": "Safe reconciliation"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Shift not found"

# Negative: Empty JSON payload returns 400
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" contains "Invalid"

# Negative: Wrong tenant isolation (non-existent/mismatched UUID)
POST {{base_url}}/api/v1/eod/close
Authorization: Bearer {{token}}
x-tenant-id: 00000000-0000-0000-0000-000000000999
x-location-id: {{location_id}}
Content-Type: application/json
{
  "shift_id": "00000000-0000-0000-0000-000000000099",
  "physical_cash_minor": 50000,
  "notes": "Safe reconciliation"
}
HTTP 403
