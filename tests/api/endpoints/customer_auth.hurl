# Endpoint: POST /api/v1/customer-auth/register and /api/v1/customer-auth/login
# Verification: Customer registration and JWT login

# Positive: Register a customer
POST {{base_url}}/api/v1/customer-auth/register
x-request-id: req-123
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "location_id": "{{location_id}}",
  "name": "Asha Rao",
  "phone": "+91 98200 12345",
  "email": "asha@example.com"
}
HTTP 200
[Asserts]
jsonpath "$.id" isString
jsonpath "$.tenant_id" == "{{tenant_id}}"
jsonpath "$.name" == "Asha Rao"
jsonpath "$.phone" == "+919820012345"
jsonpath "$.loyalty_points" == 0

# Negative: Register with bad phone format
POST {{base_url}}/api/v1/customer-auth/register
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "location_id": "{{location_id}}",
  "name": "Asha",
  "phone": "123"
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid phone number"
jsonpath "$.code" == "INVALID_PAYLOAD"

# Positive: Login customer
POST {{base_url}}/api/v1/customer-auth/login
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "phone": "+91 98200 12345"
}
HTTP 200
[Asserts]
jsonpath "$.token" isString
jsonpath "$.customer.name" == "Asha Rao"
jsonpath "$.customer.phone" == "+919820012345"
jsonpath "$.expires_in" isInteger

# Negative: Login unknown customer
POST {{base_url}}/api/v1/customer-auth/login
Content-Type: application/json
{
  "tenant_id": "{{tenant_id}}",
  "phone": "+91 98200 99999"
}
HTTP 404
[Asserts]
jsonpath "$.error" contains "Customer not found"
jsonpath "$.code" == "NOT_FOUND"
