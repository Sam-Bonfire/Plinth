# 03_testing-workflow.md - Testing for PlinthOS Monorepo

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `01_env-setup.md` (environment init - prerequisite)
- `02_local-development.md` (running components locally - prerequisite)
- `04_hexagonal-architecture.md` (architecture context for understanding test boundaries)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `tests/api/` (Hurl contract test suite)

---

## 3.1 Test Suite Overview

The PlinthOS monorepo has three distinct test suites, each serving a different purpose:

| Test Suite | Command | Scope | Purpose |
|---|---|---|---|
| **Rust Unit/Integration** | `mise run test:rust` → `cargo test --workspace` | `packages/`, `apps/` | Rust domain logic, repositories, services, edge API workers |
| **TypeScript Specs** | `mise run test:ts` → `pnpm -r test` | `apps/`, `packages/ui-kit/` | React components, Vite builds, UI kit tokens |
| **API Contract** | `mise run test:api` → `hurl --test tests/api/**/*.hurl` | `tests/api/*.hurl` | Endpoint schemas, request/response validation, auth flows |
| **Full Suite** | `mise run test` | All of above | Complete quality gate before PR merge |

---

## 3.2 Running Individual Test Suites

### 3.2.1 Rust Tests (`cargo test --workspace`)

```bash
mise run test:rust
```

**Equivalent manual command**:

```bash
cargo test --workspace --all-targets
```

**What this runs**:
- All Rust unit tests (`#[test]` macros) across the workspace
- All integration tests (`#[cfg(test)] mod tests`)
- Clippy lint checks (if configured as part of test, otherwise run separately)
- Doc tests (`#[doc = ...]` examples)

**Key Workspace Crates Tested** (from `Cargo.toml` workspace root):
- `core-domain` - Pure Rust DDD logic, order aggregates, KDS, inventory
- `sync-protocol` - CRDT protocols, mutation envecdes, offline sync
- `edge-api` - Cloudflare Workers handlers, D1 repository, auth middleware

**Common Rust Test Patterns**:

```rust
// From core-domain/src/models/order.rs test module
#[test]
fn test_order_lifecycle_and_financials() {
    let tenant_id = TenantId::new();
    let location_id = LocationId::new();
    let terminal_id = TerminalId::new();
    let staff_id = StaffMemberId::new();

    let (mut order, create_evt) = Order::new(
        tenant_id,
        location_id,
        terminal_id,
        OrderChannel::DineIn,
        staff_id,
        None,
        None,
    );
    // ... test assertions
}
```

**Troubleshooting Rust Tests**:

| Issue | Cause | Fix |
|---|---|---|
| `cargo test` fails on `#![deny(unsafe_code)]` | Unsafe code somewhere in deps | Find and remove `unsafe` block, or add `#![allow(unsafe_code)]` only if absolutely necessary (rare) |
| Test takes >30 seconds | Full workspace compilation | First run compiles everything; subsequent runs are incremental |
| `rust_decimal` precision test fails | Floating-point vs Decimal usage | Ensure all financial calcs use `rust_decimal::Decimal`, not `f64` or `f32` |

---

### 3.2.2 TypeScript Tests (`pnpm -r test`)

```bash
mise run test:ts
```

**Equivalent manual command**:

```bash
pnpm -r test
```

**What this runs**:
- Vitest test runner across all JS/TS packages
- React component unit tests (`.test.tsx` files)
- TypeScript type checks (`tsc --noEmit`)
- Linting integration (ESLint `@typescript-eslint/no-explicit-any: error`)

**Test Files Locations**:

| Directory | Pattern | Description |
|---|---|---|
| `apps/pos-client/src/` | `*.test.tsx` | POS component tests |
| `apps/web-dashboard/src/` | `*.test.tsx` | Dashboard component tests |
| `apps/marketing-site/src/` | `*.test.tsx` | Marketing site tests |
| `packages/ui-kit/` | `__tests__/**/*` | UI kit token and component tests |

**Common TSPatterns** (per `AGENTS.md` and `package.json`):

- `strict: true`, `noImplicitAny: true` in `tsconfig.json`
- `@typescript-eslint/no-explicit-any: error` enforced by ESLint
- No `any` type allowed anywhere in the codebase
- React 18 + TypeScript 5.5 + Vite 5.4 setup

**Troubleshooting TS Tests**:

| Issue | Cause | Fix |
|---|---|---|
| `TypeError: Cannot read properties of undefined` | Missing type guard | Add proper type narrowing; check for `undefined` before access |
| `Eslint: 'any' is not allowed` | Used `any` somewhere | Replace with specific type or use generics |
| `Module not found` import errors | Wrong import path | Absolute imports via `tsconfig.base.json` path mappings |
| `vite:window is not defined` | Browser API in Node context | Use `typeof window !== 'undefined'` guard or `vitest/environment-jsdom` |

---

### 3.2.3 API Contract Tests (Hurl)

```bash
mise run test:api
```

**Equivalent manual command**:

```bash
hurl --test tests/api/**/*.hurl
```

**What this runs**:

[Hurl](https://www.equal-tech.fr/hurl/) is a declarative API test framework. Test files use `.hurl` extension and specify:

- HTTP method and URL
- Request headers
- Request body (JSON)
- Expected response status codes
- JSONPath assertions on response body

**Test File Locations**:

```
tests/api/
├── create_order.hurl
├── get_kds_tickets.hurl
└── z_report_close.hurl
```

**Example Hurl Test Pattern** (from `tests/api/create_order.hurl` documented in README.md):

```hurl
# Submit Order Payload to Local Edge Worker Simulator
POST http://localhost:8787/api/v1/orders
Header "Content-Type: application/json"
Header "X-Store-Id: store_loc_99"
Header "Authorization: Bearer test_jwt_token_admin"
{
  "order_id": "ord_100982",
  "table_id": "T-04",
  "items": [
    {
      "item_id": "m1_butter_chicken",
      "quantity": 2,
      "price_cents": 34000,
      "modifiers": ["Medium Spicy"]
    }
  ],
  "tender": {
    "type": "CARD",
    "amount_cents": 68000
  }
}

# Assertions
HTTP 201
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.status" == "SUCCESS"
jsonpath "$.data.order_id" == "ord_100982"
jsonpath "$.data.total_cents" == 71400  # 68000 + 5% tax (3400)
jsonpath "$.data.sync_status" == "SETTLED"
```

**Hurl Assertion Types**:

| Assertion | Description |
|---|---|
| `HTTP 201` | Response status must be 201 Created |
| `header "Name" contains "value"` | Header must contain specified value |
| `jsonpath "$.path" == "value"` | JSON field must equal value |
| `jsonpath "$.path" count > 0` | Array must have at least N elements |
| `jsonpath "$.status" == "SUCCESS"` | String equality |

**Troubleshooting Hurl Tests**:

| Issue | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Missing/Invalid JWT | Include valid `Authorization: Bearer` header and `X-Store-Id` |
| `jsonpath assertion failed` | Response structure changed | Update jsonpath to match actual API response |
| `Connection refused` | Edge API not running | Start `mise run dev:api` first |
| `Unexpected token` in JSON | Response not JSON or malformed | Check API response format; ensure Content-Type: application/json |

---

### 3.2.4 Full Test Suite (`mise run test`)

```bash
mise run test
```

**This runs all three suites in order**:
1. `mise run test:rust` → `cargo test --workspace`
2. `mise run test:ts` → `pnpm -r test`
3. `mise run test:api` → `hurl --test tests/api/**/*.hurl`

**Expected Outcome**: All tests pass with zero failures. If any suite fails, the full `mise run test` fails and blocks PR merge (per git hook configuration in `.githooks/`).

**CI/CD Integration**: The monorepo CI workflow (`.github/workflows/ci-dev.yml`) runs `mise run test` on every PR. All tests must pass for the PR to be merged into `dev` branch (per `AGENTS.md` branch naming conventions).

---

## 3.3 Writing New Tests

### 3.3.1 Adding a Rust Unit Test

**Location**: Within the relevant Rust module (e.g., `packages/core-domain/src/models/order/tests/` or `apps/edge-api/tests/`)

**Pattern** (per existing codebase):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let val = 1 + 1;
        assert_eq!(val, 2);
    }

    #[test]
    fn domain_specific_behavior() {
        let tenant_id = TenantId::new();
        let order = Order::new(tenant_id, ...);
        assert_eq!(order.status, OrderStatus::Draft);
    }
}
```

**Safety Mandate**: All Rust crates MUST include `#![deny(unsafe_code)]` at root. Tests must not use `unsafe` blocks.

### 3.3.2 Adding a TypeScript Test

**Location**: Within the relevant `apps/` directory `__tests__/` or next to the component as `*.test.tsx`

**Pattern**:

```tsx
import { render, screen } from '@testing-library/react';
import { OrderForm } from '../order-form';

test('renders order form with initial state', () => {
  render(<OrderForm />);
  expect(screen.getByText('Take Order')).toBeInTheDocument();
});
```

**TypeScript Strict Mode**: Ensure no `any` types; use explicit types per `AGENTS.md` standards.

### 3.3.3 Adding a Hurl API Test

**Location**: `tests/api/new_endpoint.hurl`

**Pattern** (per existing `.hurl` files):

```hurl
GET http://localhost:8787/api/v1/some-endpoint
Header "X-Store-Id: store_01"
Header "Authorization: Bearer test_token"

HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.data.count" > 0
jsonpath "$.status" == "OK"
```

**Authentication**: All `/api/v1` endpoints (except `/api/v1/auth/*`) require valid JWT with `x-tenant-id` and `x-location-id` headers.

---

## 3.4 Test Coverage Expectations

| Area | Minimum Coverage | Enforcement |
|---|---|---|
| **Rust domain logic** (`core-domain`) | 80% | `cargo tarpaulin` or `cargo nextest cover` (if configured) |
| **Rust edge API** | 70% | CI checks coverage thresholds |
| **TypeScript components** | 70% | Vitest `--coverage` flag |
| **API contracts** | 100% for `/api/v1/*` | Hurl tests must cover all public endpoints |
| **Clippy lints** | 0 warnings | `cargo clippy --workspace --all-targets -- -D warnings` |

**Coverage Reports**:

```bash
# Rust coverage (if tarpaulin installed)
cargo tarpaulin --workspace

# TypeScript coverage
pnpm vitest run --coverage

# Generate combined report
# (configured in package.json scripts if present)
```

---

## 3.5 Continuous Integration (CI) Test Flow

The GitHub Actions CI (`.github/workflows/ci-dev.yml`) runs on every PR:

```yaml
# Simplified - see actual .github/workflows/ci-dev.yml for full config
name: CI / Dev

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: swornite/mise-action@v2  # Install mise
      - run: mise trust  # Lock tool versions
      - run: mise run test  # Full test suite
      # If above passes, additional steps for build, lint, etc.
```

**CI Failures that Block Merge**:
- Any Rust test panic or error
- Any TypeScript type error or lint failure
- Any Hurl contract test assertion failure
- Clippy warnings (treated as errors per `AGENTS.md`)

**Successful CI**: All tests pass → PR can be merged into `dev` branch.

---

## 3.6 Debugging Flaky Tests

| Pattern | Description |
|---|---|
| **Timing-dependent tests** | Tests that rely on `chrono::Utc::now()` or sleep() may flake; use fixed timestamps or `tokio::time::timeout` |
| **Database-integrated tests** | SQLite WAL mode locks cause timeouts; use `PRAGMA journal_mode = WAL` and run serially with `--test-threads=1` |
| **Network-dependent tests** | Hurl tests requiring edge API; always start `mise run dev:api` before running API tests |
| **Environment-variable-dependent tests** | Tests relying on `PLINTH_ENV` or JWT tokens; set vars via `export` before test run |

---

## 3.7 Next Steps

After understanding the testing workflow:

1. **Run the full suite**: `mise run test` and verify all pass
2. **Explore existing tests**: Read `tests/api/create_order.hurl`, `packages/core-domain/src/models/order/tests/`, `apps/pos-client/src/App.test.tsx`
3. **Write a small test**: Add a new Rust unit test or Hurl contract test as a learning exercise
4. **Read** `04_hexagonal-architecture.md` to understand how test boundaries align with the Ports & Adapters architecture

---

## 3.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - testing workflow overview |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new toolchain versions |

---
*This file is part of the PlinthOS internal developer documentation set. See `01_env-setup.md` for environment initialization, and `02_local-development.md` for running components locally.*