# 13_deployment-guide.md - Production Deployment Workflow for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `01_env-setup.md` (environment init prerequisite)
- `02_local-development.md` (local dev workflow prerequisite)
- `04_hexagonal-architecture.md` (deployment adapters context)
- `18_monitoring-and-observability.md` (post-deployment monitoring)
- `19_database-schema.md` (D1 schema deployment)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `AGENTS.md` (deploy branch targeting `dev`)

---

## 13.1 Deployment Commands (mise run)

All production deployments use `mise run` commands as specified in `.mise.toml`. No direct `cargo` or `pnpm` commands are used in production workflows.

### 13.1.1 Edge API Deployment

**Deploy Edge API (Cloudflare Workers) to production**:

```bash
mise run build:api
```

**Equivalent manual command** (for reference/emergency):

```bash
cd apps/edge-api
pnpm wrangler deploy
```

**What this does**:
- Compiles Rust WASM worker binary
- Bundles with Miniflare production configuration
- Deploys to Cloudflare Edge (global network)
- Updates D1 database migrations if needed
- Publishes worker routes under `*.workers.dev` or custom domain

### 13.1.2 POS Client Build

**Build native Tauri POS terminal for production**:

```bash
mise run build:pos
```

**Equivalent manual command**:

```bash
cd apps/pos-client
pnpm --filter pos-client exec tauri build
```

**What this does**:
- Compiles Rust binary in `src-tauri/target/`
- Bundles React/Vite UI
- Creates platform-specific installers (`.dmg`, `.exe`, `.apk`)
- Enables offline-first local SQLite database
- Bundles ESC/POS printer drivers

### 13.1.3 Dashboard Build

**Build Web Admin Dashboard for static hosting**:

```bash
mise run build
```

**Equivalent manual command**:

```bash
cd apps/web-dashboard
pnpm exec vite build
```

**What this produces**:
- Static HTML/CSS/JS in `dist/`
- Code-split bundles per route
- Source maps (if configured)
- Ready for Cloudflare Pages, Netlify, or static file host

### 13.1.4 Marketing Site Build

```bash
mise run dev:site  # for development
# Note: No dedicated "build:site" task in current .mise.toml;
# use `pnpm --filter marketing-site exec vite build` for production build
```

---

## 13.2 Environment-Specific Configuration

### 13.2.1 Production Environment Variables

| Variable | Production Value | Purpose |
|---|---|---|
| `PLINTH_ENV` | `production` | Enables production optimizations |
| `JWT_PUBLIC_KEY` | (from Cloudflare dashboard) | Verifies production JWT tokens |
| `D1_DATABASE_ID` | (Cloudflare D1 ID) | Production SQLite at edge |
| `VITE_API_URL` | `https://api.plinth.local` | Frontend API base URL |
| `TAURI_API_URL` | `https://api.plinth.local` | POS Tauri IPC target |

### 13.2.2 `.env.production` Files

**Each component has a production env template**:

- `apps/edge-api/.env.production` - Edge API production vars
- `apps/pos-client/src-tauri/.env.production` - POS production vars
- `apps/web-dashboard/.env.production` - Dashboard production vars

**Never commit actual secrets** to repo. Use secret management (Cloudflare Workers KV, HashiCorp Vault, etc.) and reference via `${VAR}` in `.env` files.

---

## 13.3 Migration Workflow: Local → Production

### 13.3.1 D1 Database Migration

**Local development uses** in-memory D1 (no migration needed).

**Production deployment applies** migrations in order:

```bash
# From edge API directory
mise run db:migrate:cloud
```

**Equivalent manual**:

```bash
cd apps/edge-api
pnpm wrangler d1 migrations apply plinth_cellar --remote
```

**Migration files** live in `apps/edge-api/migrations/` as SQL scripts (per `README.md` D1 Schema design).

**Migration sequence** (example):
1. `0001_initial_schema.sql` - Core tables (orders, items, tickets, stock)
2. `0002_add_indexes.sql` - Multi-tenant indexes, SLA timers
3. `0003_add_audit_columns.sql` - `created_at`, `updated_at`, `deleted_at`
4. `0004_add_tenant_isolation.sql` - `tenant_id`, `location_id` binding

### 13.3.2 Feature Flag Rollout

**New features can be toggled** without deployment:

1. Add flag in `cliff.toml` or feature flag service
2. Use `PLINTH_FEATURE_X` env var in code (feature-gated with `cfg(feature = "plinth_x")`)
3. Roll out to % of users via Cloudflare Workers KV
4. Monitor metrics; promote to 100% or rollback

---

## 13.4 Rollback Procedures

### 13.4.1 Edge API Rollback

```bash
# Deploy previous worker version
mise run build:api  # with previous code version

# Or explicitly rollback wrangler deployment
pnpm wrangler deploy --previous  # if supported by wrangler version
```

**Rollback data considerations**:
- D1 migrations are irreversible (schemaless add-only)
- If schema change caused issue: hotfix migration must be deployed
- Durable Object state may be cleared on rollback (planned restart)

### 13.4.2 POS Client Rollback

```bash
# Reinstall previous Tauri build
# From download location or internal distribution portal
```

**Rollback preserves**:
- Local SQLite data (not affected by binary rollback)
- Printer configurations
- User preferences (stored in localStorage/SQLite)

### 13.4.3 Dashboard Rollback

```bash
# Serve previous build version
npx serve dist --single -l 3000  # or use Cloudflare Pages rollback
```

**Cloudflare Pages** automatically maintains history of deployments; one-click rollback available.

---

## 13.5 Monitoring & Observability Post-Deployment

### 13.5.1 Health Check Endpoints

All production deployments should have these endpoints responding:

| Endpoint | Method | Expected Response |
|---|---|---|
| `/health` | GET | `{"status":"ok","timestamp":1725056000123,"version":"0.1.0"}` |
| `/health/db` | GET | D1 connectivity: `{"db":"connected"}` or `{"db":"degraded"}` |
| `/health/ws` | GET | Durable Object connections: count of active WebSocket connections |

### 13.5.2 Key Metrics

| Metric | Normal Range | Alert Threshold |
|---|---|---|
| **Latency (p95)** | < 100ms API response | > 500ms |
| **Error rate** | < 0.1% HTTP 4xx/5xx | > 1% |
| **D1 storage usage** | < 5 GB / 10 GB quota | > 8 GB |
| **WebSocket connections** | < 1000 per location | > 2000 (connection leak) |
| **Function cold starts** | < 50ms | > 200ms (investigate) |

### 13.5.3 Log Aggregation

Production logs are shipped to:

| Log Destination | Purpose |
|---|---|
| **Cloudflare Logs** | Workers runtime logs, errors, warnings |
| **Structured JSON logs** | `{"level":"info","msg":"order settled","order_id":"ord_123","tenant_id":"t1"}` |
| **Correlation ID** | `x-request-id` header propagated through all logs for traceability |

---

## 13.6 Database Schema Deployment (D1)

### 13.6.1 Schema Versioning

D1 schema is versioned via migration scripts in `apps/edge-api/migrations/`. Current version tracked in `wrangler.toml`:

```toml
[d1]
migrations = ["0001_initial_schema.sql", "0002_add_indexes.sql"]
current_version = "0003"
```

### 13.6.2 Applying New Schema

**When adding a new migration**:

1. **Create new SQL file** `0004_new_feature.sql` in `apps/edge-api/migrations/`
2. **Update `wrangler.toml`** to include new migration in order
3. **Deploy**: `mise run build:api` (automatically applies pending migrations)
4. **Verify**: Check D1 dashboard in Cloudflare console

### 13.6.3 Schema Change Best Practices

| Practice | Reason |
|---|---|
| **Add columns only** (never remove) | Zero-downtime deployments |
| **Use `IF NOT EXISTS`** in SQL | idempotent migration runs |
| **Index on `tenant_id` + `location_id`** | Mandatory multi-tenant isolation (per `AGENTS.md`) |
| **Preserve `deleted_at`** for soft deletes | Audit trail, data recovery |

---

## 16.7 Next Steps After Reading Deployment Guide

After reading this file, proceed with:

1. **Review current deployment status**:
   ```bash
   mise run build:api  # Verify production build works
   mise run test  # Full test suite passes
   ```

2. **Examine current migrations**:
   - `apps/edge-api/migrations/` directory
   - `wrangler.toml` migration ordering

3. **Check production environment variables**:
   - `apps/edge-api/.env.production`
   - `apps/pos-client/src-tauri/.env.production`

4. **Read** `18_monitoring-and-observability.md` for post-deployment monitoring
5. **Read** `19_database-schema.md` for D1 schema details

---

## 16.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - deployment workflow |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new deployment patterns |

---
*This file is part of the PlinthOS internal developer documentation set. See `01_env-setup.md` for environment initialization, `02_local-development.md` for local development, and `12_api-contract-tests.md` for API contract testing patterns.*