# Endpoint: POST /api/v1/webhooks/razorpay
# Verification: Rejection paths (auth, tenant isolation, malformed payload).

# Negative: Razorpay ingest without tenant header
POST {{base_url}}/api/v1/webhooks/razorpay
Content-Type: application/json
{ "event": "payment.captured", "payload": {} }
HTTP 401

# Negative: Razorpay ingest with malformed JSON
POST {{base_url}}/api/v1/webhooks/razorpay
x-tenant-id: {{tenant_id}}
Content-Type: application/json
```
{ not-json }
```
HTTP 400

# Negative: Razorpay ingest for unknown tenant (no endpoint registered)
POST {{base_url}}/api/v1/webhooks/razorpay
x-tenant-id: 11111111-1111-1111-1111-111111111111
x-webhook-secret: anything
Content-Type: application/json
{ "event": "payment.captured", "payload": {} }
HTTP 401

# Negative: Razorpay ingest with wrong secret
POST {{base_url}}/api/v1/webhooks/razorpay
x-tenant-id: {{tenant_id}}
x-webhook-secret: definitely-wrong-secret
Content-Type: application/json
{ "event": "payment.captured", "payload": {} }
HTTP 401

# Negative: Razorpay ingest with valid JSON but missing event field
POST {{base_url}}/api/v1/webhooks/razorpay
x-tenant-id: {{tenant_id}}
x-webhook-secret: {{webhook_secret}}
Content-Type: application/json
{ "payload": {} }
HTTP 400
