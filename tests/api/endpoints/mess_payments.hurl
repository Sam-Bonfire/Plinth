
# Authenticate first
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_id}}", "pin": "1234", "role": "Owner" }
HTTP 200
[Captures]
token: jsonpath "$.token"

# Top up success (404 because acc-1 does not exist in DB, but the structure is correct)
POST {{base_url}}/api/v1/mess/topup
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
{
    "account_id": "acc-1",
    "amount_minor": 1000,
    "memo": "Monthly topup"
}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"

# Pay success (404 because acc-1 does not exist)
POST {{base_url}}/api/v1/mess/pay
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
{
    "account_id": "acc-1",
    "amount_minor": 400,
    "memo": "Lunch"
}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"

# Check Balance (404 because acc-1 does not exist)
GET {{base_url}}/api/v1/mess/accounts/acc-1/balance
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"

# Pay insufficient funds (404 because acc-1 does not exist)
POST {{base_url}}/api/v1/mess/pay
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
{
    "account_id": "acc-1",
    "amount_minor": 1000000,
    "memo": "Dinner"
}
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"

# Negative amount
POST {{base_url}}/api/v1/mess/topup
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Authorization: Bearer {{token}}
{
    "account_id": "acc-1",
    "amount_minor": -100,
    "memo": "Invalid"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_AMOUNT"

# Unauthorized
POST {{base_url}}/api/v1/mess/topup
{
    "account_id": "acc-1",
    "amount_minor": 100,
    "memo": "Invalid"
}
HTTP 401
