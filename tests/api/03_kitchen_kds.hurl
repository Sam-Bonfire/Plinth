# Query active KDS tickets
GET http://localhost:8787/api/v1/kds/tickets
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# Query tickets by Grill station
GET http://localhost:8787/api/v1/kds/tickets?station=Grill
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by Tandoor station
GET http://localhost:8787/api/v1/kds/tickets?station=Tandoor
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by Beverages station
GET http://localhost:8787/api/v1/kds/tickets?station=Beverages
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by status == Pending
GET http://localhost:8787/api/v1/kds/tickets?status=Pending
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Query tickets by status == Ready
GET http://localhost:8787/api/v1/kds/tickets?status=Ready
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Combined filter: station AND status
GET http://localhost:8787/api/v1/kds/tickets?station=Grill&status=Pending
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection

# Adversarial: SQL Injection in station query param is safely bound
GET http://localhost:8787/api/v1/kds/tickets?station=Grill'%20UNION%20SELECT%201,2,3--
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$" count == 0

# Negative: Bump non-existent ticket returns 404
POST http://localhost:8787/api/v1/kds/tickets/00000000-0000-0000-0000-000000000099/bump
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "bumped_by": "00000000-0000-0000-0000-000000000005"
}
HTTP 404
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "Ticket not found"

# Negative: 86 toggle with non-existent item UUID returns 404
PATCH http://localhost:8787/api/v1/menu/items/00000000-0000-0000-0000-000000000999/availability
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "is_available": false,
  "reason": "Ghost item"
}
HTTP 404
[Asserts]
jsonpath "$.error" contains "Menu item not found"

# Negative: 86 toggle with invalid string boolean returns 400
PATCH http://localhost:8787/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{
  "is_available": "no_longer_available"
}
HTTP 400
[Asserts]
jsonpath "$.error" contains "Invalid"

# Negative: 86 toggle with empty body returns 400
PATCH http://localhost:8787/api/v1/menu/items/00000000-0000-0000-0000-000000000010/availability
Authorization: Bearer test_token_admin
x-tenant-id: 00000000-0000-0000-0000-000000000001
x-location-id: 00000000-0000-0000-0000-000000000002
Content-Type: application/json
{}
HTTP 400
