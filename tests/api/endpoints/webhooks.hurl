# Endpoint: POST /api/v1/webhooks/swiggy & POST /api/v1/webhooks/zomato
# Verification: Rejection paths (auth, tenant isolation, malformed payload).
# Happy-path 202 delivery needs a seeded webhook_endpoints row and belongs to
# seeded e2e, not this contract file.

# Negative: Swiggy ingest without tenant header
POST {{base_url}}/api/v1/webhooks/swiggy
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Swiggy ingest with malformed JSON
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
Content-Type: application/json
```
{ not-json }
```
HTTP 400

# Negative: Swiggy ingest for unknown tenant (no endpoint registered)
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-webhook-secret: anything
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Swiggy ingest with wrong secret
POST {{base_url}}/api/v1/webhooks/swiggy
x-tenant-id: {{tenant_id}}
x-webhook-secret: definitely-wrong-secret
Content-Type: application/json
{ "order_id": "SWG-1", "status": "CONFIRMED" }
HTTP 401

# Negative: Zomato ingest without tenant header
POST {{base_url}}/api/v1/webhooks/zomato
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401

# Negative: Zomato ingest with malformed JSON
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: {{tenant_id}}
Content-Type: application/json
```
[1, 2,
```
HTTP 400

# Negative: Zomato ingest for unknown tenant (no endpoint registered)
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-webhook-secret: anything
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401

# Negative: Zomato ingest with wrong secret
POST {{base_url}}/api/v1/webhooks/zomato
x-tenant-id: {{tenant_id}}
x-webhook-secret: definitely-wrong-secret
Content-Type: application/json
{ "orderId": "ZOM-1", "state": "CONFIRMED" }
HTTP 401
