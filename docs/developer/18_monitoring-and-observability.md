# 18_monitoring-and-observability.md - System Monitoring and Observability

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `13_deployment-guide.md` (deployment commands prerequisite)
- `19_database-schema.md` (D1 schema monitoring context)
- `04_hexagonal-architecture.md` (observability across hexagonal layers)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `AGENTS.md` (health check requirements)

---

## 18.1 Health Check Endpoints

All PlinthOS services expose health endpoints for infrastructure monitoring (Kubernetes, Docker, Cloudflare Observability).

### 18.1.1 Edge API Health Checks

| Endpoint | Method | Expected Response | Purpose |
|---|---|---|---|
| `/health` | GET | `{"status":"ok","timestamp":1725056000123,"version":"0.1.0"}` | Overall service health |
| `/health/db` | GET | `{"db":"connected"}` or `{"db":"degraded"}` | D1 SQLite connectivity |
| `/health/ws` | GET | `{"active_connections":42}` | Durable Object WebSocket connections |
| `/health/queues` | GET | `{"pending_mutations":15}` | Sync queue depth |

**Example health check script**:

```bash
#!/bin/bash
# Check all edge API health endpoints
API_URL="https://api.plinth.local"

echo "Checking /health..."
curl -s "${API_URL}/health" | jq .

echo "Checking /health/db..."
curl -s "${API_URL}/health/db" | jq .

echo "Checking /health/ws..."
curl -s "${API_URL}/health/ws" | jq .

# Exit code 1 if any check fails
```

### 18.1.2 POS Client Health

The Tauri POS terminal does not expose HTTP health endpoints (local-first architecture). Health is assessed via:

- **App responsiveness** (UI renders, no spinny spinners)
- **Database accessibility** (local SQLite queries succeed)
- **Printer connection** (ESC/POS status)
- **Network status indicator** in UI (online/offline badge)

### 18.1.3 Dashboard Health

The Next.js dashboard inherits edge API health, plus:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/health` | GET | Proxy to edge API `/health` |
| `/api/v1/metrics` | GET | Exported metrics (see 18.3) |

---

## 18.2 Request ID Tracing (`x-request-id`)

Every API request must propagate a unique `x-request-id` header for distributed tracing.

### 18.2.1 Header Propagation

```http
# Client request
GET /api/v1/orders HTTP/1.1
X-Store-Id: store_01
X-Request-Id: req-abc123def456  # UUID v7 or timestamp-based

# Edge API forwards to D1, adds its own trace
# Durable Objects include it in WebSocket frames
# All logs include this ID for correlation
```

### 18.2.2 Retrieving from Response

```http
# Server response includes the same ID
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: req-abc123def456

# Useful for correlating logs across services
grep "req-abc123def456" /var/log/plinth/*.log
```

**Per `AGENTS.md` and `04_hexagonal-architecture.md`, the `x-request-id` is set by `get_request_id()` in `apps/edge-api/src/router.rs`**.

---

## 18.3 Exported Metrics (Prometheus Format)

PlinthOS metrics are exposed in Prometheus-compatible format for observability pipelines.

### 18.3.1 Metrics Endpoint

```
GET https://api.plinth.local/metrics
```

### 18.3.2 Core Metrics

| Metric Name | Type | Description | Labels |
|---|---|---|---|
| `plinth_requests_total` | counter | Total HTTP requests handled | `method`, `endpoint`, `status_code` |
| `plinth_request_duration_seconds` | histogram | Request latency (bucketed) | `method`, `endpoint` |
| `plinth_active_connections` | gauge | Active WebSocket connections per DO | `location_id` |
| `plinth_d1_storage_bytes` | gauge | D1 database storage usage | `tenant_id` |
| `plinth_order_settled_total` | counter | Total orders settled | `tenant_id` |
| `plinth_kds_tickets_pending` | gauge | Pending KDS tickets count | `station_id` |
| `plinth_sla_red_alerts_total` | counter | SLA Red alerts triggered | `location_id` |

### 18.3.3 Sample Metrics Output

```text
# HELP plinth_requests_total Total HTTP requests handled
# TYPE plinth_requests_total counter
plinth_requests_total{method="POST",endpoint="/api/v1/orders",status_code="201"} 47
plinth_requests_total{method="GET",endpoint="/api/v1/kds/tickets",status_code="200"} 12

# HELP plinth_request_duration_seconds Request latency in seconds
# TYPE plinth_request_duration_seconds histogram
plinth_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/orders",le="0.1"} 123
plinth_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/orders",le="0.5"} 456
plinth_request_duration_seconds_bucket{method="GET",endpoint="/api/v1/orders",le="1.0"} 500
plinth_request_duration_seconds_sum{method="GET",endpoint="/api/v1/orders"} 123.456
plinth_request_duration_seconds_count{method="GET",endpoint="/api/v1/orders"} 500

# HELP plinth_d1_storage_bytes D1 storage per tenant
# TYPE plinth_d1_storage_bytes gauge
plinth_d1_storage_bytes{tenant_id="tenant_42"} 2147483648  # 2GB

# HELP plinth_kds_tickets_pending Pending KDS tickets
# TYPE plinth_kds_tickets_pending gauge
plinth_kds_tickets_pending{station_id="GRILL_01"} 23

# HELP plinth_sla_red_alerts_total SLA Red alerts
# TYPE plinth_sla_red_alerts_total counter
plinth_sla_red_alerts_total{location_id="loc_99"} 7
```

### 18.3.4 Setting Up Metrics Scraping

**Prometheus config example**:

```yaml
scrape_configs:
  - job_name: "plinth-edge-api"
    static_configs:
      - targets: ["api.plinth.local:8787"]
    metrics_path: "/metrics"
  - job_name: "plinth-dashboard"
    static_configs:
      - targets: ["dashboard.plinth.local:3000"]
    metrics_path: "/api/v1/metrics"
```

---

## 18.4 Log Structuring and Correlation

All PlinthOS services emit **structured JSON logs**. No plain-text/printf logging.

### 18.4.1 Log Format

```json
{"timestamp":"2026-08-28T14:30:00.123Z","level":"info","message":"order_settled","x_request_id":"req-abc123def456","order_id":"ord-701","tenant_id":"tenant_42","total_cents":71400,"duration_ms":45}
```

### 18.4.2 Log Fields (Required)

| Field | Type | Description |
|---|---|---|
| `timestamp` | ISO 8601 UTC string | When the event occurred |
| `level` | string | `debug`, `info`, `warn`, `error` |
| `message` | string | Human-readable event summary |
| `x_request_id` | string | Correlation ID (mandatory) |
| Additional fields | varies | Event-specific data (order_id, tenant_id, etc.) |

### 18.4.3 Log Aggregation Destinations

| Destination | Purpose |
|---|---|
| **Cloudflare Logs** | Workers runtime logs |
| **Elasticsearch** | Full-text search, analytics |
| **Grafana Loki** | Lightweight log aggregation (often alongside Prometheus) |
| **Local files** (development only) | `CARGO_TERM_COLOR=always` output |

### 18.4.4 Log Search Examples

```bash
# Find all order settlement events
grep '"message":"order_settled"' /var/log/plinth/*.json | head -20

# Correlate by request ID across services
grep "req-abc123def456" /var/log/plinth-edge*.json /var/log/plinth-dashboard*.json

# Find SLA Red alerts
grep '"level":"warn"' *.json | grep 'sla_red' | wc -l
```

---

## 18.5 Alerting Thresholds

| Alert | Condition | Notification Channel |
|---|---|---|
| **High Error Rate** | `plinth_requests_total{status_code=~"5.."} / plinth_requests_total > 0.01` | Slack #plinth-alerts |
| **D1 Storage Near Limit** | `plinth_d1_storage_bytes > 8_000_000_000` (8GB of 10GB) | Email on-call |
| **SLA Red Spike** | `plinth_sla_red_alerts_total` increases > 5 in 5 min | SMS to lead dev |
| **WebSocket Connection Leak** | `plinth_active_connections` increases > 100/min without drops | PagerDuty |
| **Durable Object Error** | Any `error` level log from DO process | Slack #plinth-dev |

### 18.5.1 Alert Routing

Alerts flow through:

1. **Detection**: Prometheus + Alertmanager
2. **Routing**: Alertmanager config routes by severity/team
3. **Delivery**: Slack, Email, SMS, PagerDuty
4. **Acknowledgment**: Team member acknowledges; alert clears when condition resolves

---

## 18.6 Development vs Production Monitoring

| Feature | Development (`mise run dev:api`) | Production |
|---|---|---|
| **Health endpoints** | Available at `localhost:8787` | Available at `https://api.plinth.local` |
| **Metrics format** | `cargo run --bin show_metrics` (dev tool) | Prometheus endpoint |
| **Log output** | Colored `cargo term` output | Structured JSON to Cloudflare/Loki |
| **Alertmanager** | Not configured | Active (Slack/PagerDuty) |
| **SLA timers** | Visible in KDS UI | Same, but also monitored via metrics |
| **Error handling** | Panics shown in terminal | Structured error responses + logs |

---

## 18.7 Debugging Production Issues

### 18.5.1 Common Production Problems

| Symptom | Likely Cause | Investigation Steps |
|---|---|---|
| "All orders returning 401" | JWT key rotated, not deployed | Redeploy edge API with new `JWT_PUBLIC_KEY`; verify `wrangler.toml` |
| "D1 quota exceeded" | Too many rows/columns | Review migration scripts; archive old data (cold storage via R2) |
| "KDS tickets not updating" | Durable Object WebSocket connection lost | Check DO IDs; verify `wrangler.toml` binding; restart DO via `wrangler dev --remote` |
| "SLA timers inaccurate" | Server clock drift | Sync via NTP; verify `timedatectl`; reset timers if needed |
| "Split payments not reflecting" | Missing `x-request-id` propagation | Ensure all API hops propagate the header; check middleware |

### 18.5.2 Troubleshooting Checklist

```bash
# 1. Verify health endpoints
curl https://api.plinth.local/health
curl https://api.plinth.local/health/db

# 2. Check metrics
curl https://api.plinth.local/metrics | head -20

# 3. Review recent logs
journalctl -u plinth-edge-api --since "1 hour ago" | grep -i error | tail -20

# 3. Verify request ID propagation
# Make a test request with known ID:
curl -H "X-Request-Id: test-12345" https://api.plinth.local/health
# Check logs for test-12345

# 4. Verify D1 connectivity
wrangler d1 query plinth_cellar --remote --text "SELECT count(*) FROM orders"

# 5. Restart if needed
wrangler dev --remote --restart
```

---

## 18.8 Next Steps After Reading Monitoring Guide

After reading this file, proceed with:

1. **Set up metrics scraping** in your Prometheus instance
2. **Configure alert routes** (Slack webhook, email, SMS)
3. **Verify health endpoints** are accessible in your deployment environment
4. **Review log structure** in your aggregation system (Loki/Elasticsearch)
5. **Read** `19_database-schema.md` for D1-specific monitoring considerations
6. **Read** `13_deployment-guide.md` for deployment-related observability

---

## 18.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - monitoring and observability |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new monitoring patterns |

---
*This file is part of the PlinthOS internal developer documentation set. See `13_deployment-guide.md` for deployment commands, `19_database-schema.md` for D1 schema, and `AGENTS.md` for health check requirements.*