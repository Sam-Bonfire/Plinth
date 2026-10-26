# Endpoint: POST /api/v1/webhooks/swiggy & POST /api/v1/webhooks/zomato
# Verification: Rejection paths (auth, tenant isolation, malformed payload).
# Happy-path 202 delivery needs a seeded webhook_endpoints row and belongs to
# seeded e2e, not this contract file.

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
x-webhook-signature: 66b77c36822446be0e6ec67eabd6afcb4b2700e0a7ce3dab54d0aa53ad336422
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

# Positive: Swiggy ingest successful delivery
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-idempotency-key: idemp-swiggy-1
x-webhook-signature: 43a652e2be2d37c95b6c927f8cf28fde14022db25da2c8b7c7a36081da2eb486
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 202
[Captures]
swg_order_id: jsonpath "$.order_id"

# Positive: Swiggy ingest replay uses idempotency key
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-idempotency-key: idemp-swiggy-1
x-webhook-signature: 43a652e2be2d37c95b6c927f8cf28fde14022db25da2c8b7c7a36081da2eb486
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 200
[Asserts]
jsonpath "$.order_id" == {{swg_order_id}}

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
