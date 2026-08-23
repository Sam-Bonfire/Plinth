# Health check probe for Plinth Edge API
GET http://localhost:8787/health

HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "healthy"
