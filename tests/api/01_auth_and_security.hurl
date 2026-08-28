# -------------------------------------------------------------
# PlinthOS API Test Suite: 01 Auth & Security Matrix
# -------------------------------------------------------------

# 1. Health Probe Verification
GET http://localhost:8787/health
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "ok"
jsonpath "$.version" isString
jsonpath "$.timestamp" isInteger

# 2. Reject unauthenticated request missing x-tenant-id & Authorization
POST http://localhost:8787/api/v1/orders
Content-Type: application/json
{
  "channel": "DineIn",
  "terminal_id": "term-test-01",
  "items": []
}
HTTP 401
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.code" == "UNAUTHORIZED"
jsonpath "$.error" isString

# 3. Reject request with invalid/expired bearer token
GET http://localhost:8787/api/v1/menu
Authorization: Bearer invalid-garbage-token-abc
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 401
[Asserts]
jsonpath "$.code" == "UNAUTHORIZED"
