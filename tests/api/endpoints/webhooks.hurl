# Endpoint: POST /api/v1/webhooks/swiggy & POST /api/v1/webhooks/zomato
# Verification: rejection paths plus an idempotent materializing delivery.
# Happy paths need the seeded webhook_endpoints row from tests/api/seeds/local.sql
# (secret "dev-webhook-secret"), so run after `mise run db:seed:local`.

# Negative: Swiggy ingest without tenant header
POST {{base_url}}/api/v1/webhooks/swiggy
x-idempotency-key: 1234
x-webhook-signature: 66b77c36822446be0e6ec67eabd6afcb4b2700e0a7ce3dab54d0aa53ad336422
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Swiggy ingest missing idempotency key
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-webhook-signature: d977a1d4199c233607659bb79c9662a986988f44afdc1f7d35c9776b89046ed6
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 400

# Negative: Swiggy ingest with malformed JSON
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-idempotency-key: 1234
x-webhook-signature: anything
Content-Type: application/json
```
{ not-json }
```
HTTP 400

# Negative: Swiggy ingest for unknown tenant (no endpoint registered)
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-idempotency-key: 1234
x-webhook-signature: anything
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Swiggy ingest with wrong signature
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-idempotency-key: 1234
x-webhook-signature: definitely-wrong-signature
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Swiggy ingest without a location header cannot materialize an order
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-idempotency-key: no-location
x-webhook-signature: d977a1d4199c233607659bb79c9662a986988f44afdc1f7d35c9776b89046ed6
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 400

# Positive: Swiggy ingest materializes an order and kitchen ticket
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
x-idempotency-key: idemp-swiggy-1
x-webhook-signature: d977a1d4199c233607659bb79c9662a986988f44afdc1f7d35c9776b89046ed6
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 202
[Asserts]
jsonpath "$.success" == true
jsonpath "$.order_id" exists
[Captures]
swg_order_id: jsonpath "$.order_id"
swg_delivery_id: jsonpath "$.delivery_id"

# Positive: Swiggy replay returns the original order under the same delivery
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
x-idempotency-key: idemp-swiggy-1
x-webhook-signature: d977a1d4199c233607659bb79c9662a986988f44afdc1f7d35c9776b89046ed6
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 200
[Asserts]
jsonpath "$.order_id" == {{swg_order_id}}
jsonpath "$.delivery_id" == {{swg_delivery_id}}

# Negative: Zomato ingest without tenant header
POST {{base_url}}/api/v1/webhooks/zomato
x-idempotency-key: 1234
x-webhook-signature: anything
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401

# Negative: Zomato ingest with malformed JSON
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: {{tenant_id}}
x-idempotency-key: 1234
x-webhook-signature: anything
Content-Type: application/json
```
[1, 2,
```
HTTP 400

# Negative: Zomato ingest for unknown tenant (no endpoint registered)
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-idempotency-key: 1234
x-webhook-signature: anything
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401

# Negative: Zomato ingest with wrong signature
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: {{tenant_id}}
x-idempotency-key: 1234
x-webhook-signature: definitely-wrong-signature
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401

# Positive: Zomato ingest materializes its own order and kitchen ticket
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: {{tenant_id}}
x-location-id: {{location_id}}
x-idempotency-key: idemp-zomato-1
x-webhook-signature: f241842e01ea331d68b05b3aba9d6817305ba2660a90bea7bff654544878188d
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 202
[Asserts]
jsonpath "$.order_id" exists
