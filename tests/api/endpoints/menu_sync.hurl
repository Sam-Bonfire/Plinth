# Endpoint: POST /api/v1/menu/sync
# Verification: Aggregator menu sync run queueing

# Positive: Queue sync for both platforms
POST {{base_url}}/api/v1/menu/sync
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "platforms": ["Swiggy", "Zomato"],
  "menu_version": "v42",
  "item_count": 12
}
HTTP 202
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.success" == true
jsonpath "$.runs" isCollection

# Negative: Empty platforms rejected
POST {{base_url}}/api/v1/menu/sync
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "platforms": [],
  "menu_version": "v42",
  "item_count": 12
}
HTTP 400

# Negative: Unknown platform rejected
POST {{base_url}}/api/v1/menu/sync
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
Content-Type: application/json
{
  "platforms": ["UberEats"],
  "menu_version": "v42",
  "item_count": 12
}
HTTP 400

# Negative: Missing tenant rejected
POST {{base_url}}/api/v1/menu/sync
Authorization: Bearer {{token}}
Content-Type: application/json
{
  "platforms": ["Swiggy"],
  "menu_version": "v42",
  "item_count": 12
}
HTTP 401
