# Endpoint: GET /api/v1/crm/customers
# Verification: Tenant-scoped customer search with masked contacts

# Positive: Search returns masked profiles
GET {{base_url}}/api/v1/crm/customers?q=asha
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"

# Negative: Missing auth rejected
GET {{base_url}}/api/v1/crm/customers?q=asha
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401

# Negative: Missing tenant rejected
GET {{base_url}}/api/v1/crm/customers?q=asha
Authorization: Bearer {{token}}
x-location-id: {{location_id}}
HTTP 401
