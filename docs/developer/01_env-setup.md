# 01_env-setup.md - Environment Initialization for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0 (matches codebase version)  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `02_local-development.md` (next step in local development workflow)
- `03_testing-workflow.md` (testing after environment setup)
- `DEVELOPER-GLOSSARY.md` (key term definitions)

---

## 1.1 Prerequisites

Before beginning PlinthOS development, ensure the following tools are installed and version-managed via **mise**:

| Tool | Minimum Version | Purpose |
|---|---|---|
| `node` | `24` | React/Next.js applications, Vite dev server |
| `pnpm` | `latest` | Monorepo package management |
| `rust` | `stable` | Core domain logic, edge API, Tauri backend |
| `hurl` | `8` | API contract testing |
| `cargo:tauri-cli` | `2.0.0` | POS terminal native build |
| `cargo:cargo-nextest` | `latest` | Rust test runner (alternative to cargo test) |

**Setup Command** (run once):

```bash
mise trust
```

This command:
- Reads `.mise.toml` and `.tool-versions` (if present)
- Downloads/install specified tool versions if missing
- Locks versions to avoid "works on my machine" issues

---

## 1.2 Initializing the Development Environment

After trust is established, initialize the full development environment:

```bash
pnpm run init
```

**What this does** (per `package.json` and `.mise.toml`):

1. Configures git hooks path to `.githooks`:
   ```bash
   git config core.hooksPath .githooks
   ```

2. Installs all monorepo dependencies:
   ```bash
   pnpm install
   ```

3. Verifies toolchain compatibility (mise enforces versions from `.mise.toml`)

---

## 1.3 Component-Specific Initialization

### For Edge API (Cloudflare Workers)

```bash
# Navigate to edge API directory
cd apps/edge-api

# Install edge-specific dependencies
pnpm install

# Verify D1 database is accessible
# (local dev uses Miniflare, production uses Cloudflare D1)
```

### For POS Client (Tauri Native Terminal)

```bash
# Navigate to POS client directory
cd apps/pos-client

# Install Tauri and React dependencies
pnpm install

# Ensure Rust toolchain is available
rustc --version  # Should report stable edition 2021
```

### For Web Dashboard (Next.js Admin)

```bash
cd apps/web-dashboard

# Install dashboard dependencies
pnpm install
```

### For Marketing Site

```bash
cd apps/marketing-site

# Install marketing site dependencies
pnpm install
```

---

## 1.4 Daily Development Workflow

### Starting the Edge API Simulator

```bash
mise run dev:api
```

**Equivalent manual command** (for reference/debugging):

```bash
cd apps/edge-api
pnpm wrangler dev --port 8787
```

**What this starts**:
- Miniflare (Cloudflare Workers runtime emulator)
- D1 in-memory database for local development
- WebSocket endpoints for Durable Objects
- Health check at `http://localhost:8787/health`
- API routes under `/api/v1/*`

### Starting the POS Client

```bash
mise run dev:pos
```

**Equivalent manual command**:

```bash
cd apps/pos-client
pnpm --filter pos-client exec tauri dev
```

**What this starts**:
- Tauri development server
- React 18 UI shell
- Local SQLite database (rusqlite with WAL mode)
- ESC/POS printer simulation
- Background sync daemon (Tokio async)

### Starting the Web Dashboard

```bash
mise run dev:web
```

**Equivalent manual command**:

```bash
cd apps/web-dashboard
pnpm exec vite dev
```

**What this starts**:
- Next.js 14 App Router (or Vite dev server based on config)
- Ant Design 5.x component library
- Hot module replacement (HMR)
- Proxy to edge API at `http://localhost:8787`

### Starting the Marketing Site

```bash
mise run dev:site
```

---

## 1.5 Testing the Environment

After setup, verify everything works by running the test suite:

```bash
mise run test
```

**This executes** (per `.mise.toml` tasks):

1. `mise run test:rust` → `cargo test --workspace`
2. `mise run test:ts` → `pnpm -r test`
3. `mise run test:api` → `hurl --test tests/api/**/*.hurl`

**Expected output**: All tests pass with no failures. If Rust tests fail, check `#![deny(unsafe_code)]` compliance. If TS tests fail, check strict typing (`noImplicitAny`).

---

## 1.6 Common Environment Issues

| Issue | Likely Cause | Resolution |
|---|---|---|
| `mise: command not found` | mise not installed or not in PATH | Install mise: `curl https://mise.jdx.dev/install.sh \| sh` |
| `pnpm: command not found` | pnpm not installed | `mise install pnpm` then restart terminal |
| `cargo test --workspace` times out | Missing dependency compilation | Run `cargo build --workspace` first to compile |
| `wrangler dev` fails on port 8787 | Port already in use | Kill process on 8787 or use `pnpm wrangler dev --port 8788` |
| TypeScript errors about `any` | Relaxed typing standards | Check for `any` usage and replace with explicit types; run `pnpm -r lint` |
| Hurl tests returning 401 | Missing JWT auth headers | Include `Authorization: Bearer <token>` and `X-Store-Id: <store_id>` |
| Tauri build fails on POS | Missing Rust target | `mise run init` ensures toolchain; check `apps/pos-client/src-tauri/Cargo.toml` |

---

## 1.7 Directory Structure Overview

After completing initialization, the monorepo layout should look like:

```
plinth-monorepo/
├── .mise.toml          # Tool versions and tasks (already exists)
├── package.json        # pnpm workspace root
├── Cargo.toml          # Cargo workspace root
├── pnpm-lock.yaml      # Lock file for pnpm
├── ...
├── apps/
│   ├── edge-api/       # Cloudflare Workers
│   │   ├── src/
│   │   ├── Cargo.toml
│   │   └── wrangler.toml
│   ├── pos-client/     # Tauri POS terminal
│   │   ├── src-tauri/
│   │   │   ├── main.rs
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   └── src/
│   ├── web-dashboard/  # Next.js admin
│   │   ├── src/
│   │   └── package.json
│   └── marketing-site/ # Public site
│       ├── src/
│       └── package.json
├── packages/
│   ├── core-domain/    # Pure Rust DDD logic
│   │   ├── src/
│   │   └── Cargo.toml
│   └── sync-protocol/  # CRDT protocols
│       ├── src/
│       └── Cargo.toml
├── docs/               # **This documentation directory**
│   └── developer/      # ← We're here!
│   └── user/           # End user documentation
├── tests/              # Hurl API contract tests
│   └── api/
│       ├── create_order.hurl
│       └── get_kds_tickets.hurl
└── README.md           # Already extensive system overview
```

---

## 1.8 Next Steps

After completing environment setup:

1. **Read** `02_local-development.md` to understand running each component locally
2. **Run** `mise run test` to verify the environment is correctly configured
3. **Review** `03_testing-workflow.md` to understand the testing patterns used across the monorepo
4. **Introduce** yourself to the codebase by reading `README.md` (already extensive system architecture overview)

---

## 1.9 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - environment setup guide |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new toolchain versions |

---
*This file is part of the PlinthOS internal developer documentation set. See related files for complete onboarding pathway.*