# Endpoint: GET /health
# Verification: Service liveness and version info
GET {{base_url}}/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger
