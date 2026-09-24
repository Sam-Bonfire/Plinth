# Endpoint: POST /api/v1/marketing/leads
# Verification: Trial-request lead capture

# Positive: Submit a valid lead
POST {{base_url}}/api/v1/marketing/leads
Content-Type: application/json
{
  "name": "Asha Rao",
  "phone": "+91 98200 12345",
  "outlets": 2,
  "city": "Bengaluru"
}
HTTP 202
[Asserts]
jsonpath "$.lead_id" isString

# Negative: Blank name rejected
POST {{base_url}}/api/v1/marketing/leads
Content-Type: application/json
{
  "name": "  ",
  "phone": "+91 98200 12345",
  "outlets": 1,
  "city": "Bengaluru"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_PAYLOAD"

# Negative: Bad phone rejected
POST {{base_url}}/api/v1/marketing/leads
Content-Type: application/json
{
  "name": "Asha",
  "phone": "123",
  "outlets": 1,
  "city": "Bengaluru"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_PAYLOAD"

# Negative: Zero outlets rejected
POST {{base_url}}/api/v1/marketing/leads
Content-Type: application/json
{
  "name": "Asha",
  "phone": "+91 98200 12345",
  "outlets": 0,
  "city": "Bengaluru"
}
HTTP 400
[Asserts]
jsonpath "$.code" == "INVALID_PAYLOAD"
