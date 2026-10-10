# Endpoint: /api/v1/staff*
# Verification: Staff CRUD and PIN verification contracts
# Prerequisite: simulator seeded via `mise run db:seed:local`
# ({{staff_owner_id}} must be the seeded Owner with PIN 1234,
# {{staff_waiter_id}} the seeded Waiter with PIN 1234).

# Authenticate as Owner (holds MANAGE_STAFF)
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_owner_id}}", "pin": "1234" }
HTTP 200
[Captures]
token_owner: jsonpath "$.token"

# Positive: Create staff returns 201 with generated id
POST {{base_url}}/api/v1/staff
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "Hurl Cashier",
  "role": "Cashier",
  "pin": "1234"
}
HTTP 201
[Captures]
new_staff_id: jsonpath "$.id"
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.id" isString
jsonpath "$.name" == "Hurl Cashier"
jsonpath "$.role" == "Cashier"
jsonpath "$.is_active" == true

# Negative: Empty name returns 400
POST {{base_url}}/api/v1/staff
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "   ",
  "role": "Waiter",
  "pin": "1234"
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "cannot be empty"

# Negative: Short PIN returns 400
POST {{base_url}}/api/v1/staff
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "Hurl Waiter",
  "role": "Waiter",
  "pin": "12"
}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "PIN must be 4-6"

# Positive: List staff includes the created row
GET {{base_url}}/api/v1/staff
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.total" >= 1
jsonpath "$.data" isCollection

# Positive: Get created staff by id
GET {{base_url}}/api/v1/staff/{{new_staff_id}}
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.id" == "{{new_staff_id}}"
jsonpath "$.name" == "Hurl Cashier"

# Negative: Get unknown staff returns 404
GET {{base_url}}/api/v1/staff/00000000-0000-0000-0000-000000000099
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Staff not found"

# Positive: Patch staff name
PATCH {{base_url}}/api/v1/staff/{{new_staff_id}}
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "Hurl Cashier Renamed"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.name" == "Hurl Cashier Renamed"

# Positive: Correct PIN verifies
POST {{base_url}}/api/v1/staff/{{new_staff_id}}/pin-verify
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "pin": "1234"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.valid" == true
jsonpath "$.staff_id" == "{{new_staff_id}}"

# Negative: Wrong PIN reports invalid without error status
POST {{base_url}}/api/v1/staff/{{new_staff_id}}/pin-verify
Authorization: Bearer {{token_owner}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "pin": "9999"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.valid" == false

# Authenticate as Waiter (lacks MANAGE_STAFF)
POST {{base_url}}/api/v1/auth/login
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{ "staff_id": "{{staff_waiter_id}}", "pin": "1234" }
HTTP 200
[Captures]
token_waiter: jsonpath "$.token"

# Negative: Waiter cannot create staff (denied)
POST {{base_url}}/api/v1/staff
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "Hurl Intruder",
  "role": "Waiter",
  "pin": "1234"
}
HTTP 401

# Negative: Waiter cannot patch staff (denied)
PATCH {{base_url}}/api/v1/staff/{{new_staff_id}}
Authorization: Bearer {{token_waiter}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "name": "Hurl Intruder"
}
HTTP 401

# Negative: Unauthenticated list returns 401
GET {{base_url}}/api/v1/staff
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
HTTP 401
