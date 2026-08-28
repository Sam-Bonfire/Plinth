# -------------------------------------------------------------
# PlinthOS API Test Suite: 03 Kitchen & KDS Operations Matrix
# -------------------------------------------------------------

# 1. Query Active KDS Tickets by Station
GET http://localhost:8787/api/v1/kds/tickets?station=Grill
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$" isCollection

# 2. Toggle Menu Item Availability (86 Item)
PATCH http://localhost:8787/api/v1/menu/items/item-butter-chicken/availability
Authorization: Bearer test_jwt_token_admin
x-tenant-id: tenant-sample-01
x-location-id: loc-sample-01
Content-Type: application/json
{
  "is_available": false,
  "reason": "Sold out for dinner service"
}
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.is_available" == false
