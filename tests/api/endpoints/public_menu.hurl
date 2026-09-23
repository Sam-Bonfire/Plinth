# Endpoint: GET /api/v1/public/menu?tenant_id=<uuid>
# Verification: Public catalog retrieval

# Positive: Retrieve public menu catalog
GET {{base_url}}/api/v1/public/menu?tenant_id={{tenant_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.categories" isCollection

# Negative: Missing tenant_id
GET {{base_url}}/api/v1/public/menu
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" == "Missing tenant_id"

# Negative: Invalid tenant_id format
GET {{base_url}}/api/v1/public/menu?tenant_id=invalid-uuid
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" == "Invalid tenant_id"
