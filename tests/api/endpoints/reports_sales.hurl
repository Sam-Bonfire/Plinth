# Endpoint: GET /api/v1/reports/sales
# Verification: Sales financial analytics query contract

# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Query sales analytics for today
GET {{base_url}}/api/v1/reports/sales?period=today
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total_revenue_minor" isInteger
jsonpath "$.total_orders" isInteger
jsonpath "$.tax_liability_minor" isInteger

# Query sales analytics for custom date range
GET {{base_url}}/api/v1/reports/sales?date_from=2026-08-01T00:00:00Z&date_to=2026-08-28T23:59:59Z
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total_revenue_minor" isInteger
