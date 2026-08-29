# 07_rust-safety-mandates.md - Non-Negotiable Rust Safety Standards for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `04_hexagonal-architecture.md` (these mandates apply to the hexagonal structure)
- `06_domain-modeling-patterns.md` (modeling decisions affected by these rules)
- `08_typescript-standards.md` (equivalent TS standards per AGENTS.md)
- `AGENTS.md` (source of truth for all project conventions)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 7.1 Mandate #1: Zero Unsafe Code (`#![deny(unsafe_code)]`)

### 7.1.1 Requirement

**Every** Rust crate in the PlinthOS monorepo **MUST** include `#![deny(unsafe_code)]` at the root level of its `lib.rs` or `main.rs`. There are **no exceptions**.

### 7.1.2 Where This Applies

| Crate | Location | Example |
|---|---|---|
| `core-domain` | `packages/core-domain/src/lib.rs` | `#![deny(unsafe_code)]` at line 1 |
| `sync-protocol` | `packages/sync-protocol/src/lib.rs` | `#![deny(unsafe_code)]` at line 1 |
| `edge-api` | `apps/edge-api/src/lib.rs` | `#![deny(unsafe_code)]` at line 1 |
| `pos-client` (Tauri) | `apps/pos-client/src-tauri/src/lib.rs` | `#![deny(unsafe_code)]` at line 1 |

### 7.1.2 Rationale

| Reason | Explanation |
|---|---|
| **Financial Safety** | PlinthOS handles monetary calculations; `unsafe` blocks could corrupt precision |
| **Memory Safety** | Edge computing at scale requires reliability; unsafe code is a liability |
| **Auditability** | `#![deny(unsafe_code)]` makes audits straightforward - either it's allowed or not |
| **Tooling Support** | Clippy, rust-analyzer, and IDEs can provide better guarantees when unsafe is forbidden |

### 7.1.3 Detection & Enforcement

**Build will fail** if any crate uses `unsafe` without `#![deny(unsafe_code)]`:

```bash
# This will compile and then fail at the deny attribute
cargo build --workspace

# Clippy also enforces this
cargo clippy --workspace --all-targets -- -D warnings
```

**Manual audit checklist** (run periodically):
- [ ] Every `lib.rs`/`.rs` file in `packages/` and `apps/` contains `#![deny(unsafe_code)]` on line 1 or very early
- [ ] No `unsafe` blocks exist anywhere in the workspace without the deny attribute
- [ ] If `unsafe` is truly unavoidable (rare), it requires ARCHITECTURE REVIEW and `#[allow(unsafe_code)]` on the specific function/module with documented justification

### 7.1.4 What Counts as `unsafe`

| Construct | Category | Required Action |
|---|---|---|
| `unsafe fn` | Function declaration | Must have `#[allow(unsafe_code)]` on the function or outer module |
| `unsafe { }` | Block | Generally forbidden; requires review |
| `ptr::write`, `ptr::read` | Raw pointer ops | Forbidden - use safe abstractions instead |
| `extern "C"` | FFI | Requires architecture review; add `#[allow(unsafe_code)]` at crate root if needed |
| `global_asm!` | Assembly | Forbidden - use linker scripts instead |

### 7.1.5 Code Review Checklist for Unsafe

| Question | Expected Answer |
|---|---|
| "Does this crate have `#![deny(unsafe_code)]`?" | Yes, at root |
| "If `unsafe` is used, is it absolutely unavoidable?" | Yes, with review |
| "Is the unsafe block minimal and well-documented?" | Yes |
| "Are there safe alternatives that were rejected?" | Documented rationale |

---

## 7.2 Mandate #2: Financial Precision (`rust_decimal::Decimal`)

### 7.2.1 Requirement

**All** monetary/financial calculations MUST use `rust_decimal::Decimal` (IEEE-754 floating point arithmetic is **strictly prohibited**). This applies to:

- Order totals, line item prices
- Discount amounts, surcharges/fees
- Tax calculations (GST/HST/VAT)
- Tip/gruatuity amounts
- Payment amounts, change due
- Z-report revenue totals
- Any `f64`, `f32`, or `i32`/`i64` used as currency amounts **must** be converted to minor-unit `Decimal` before calculation

### 7.2.2 Rationale

| Risk | Why Floating-Point Fails |
|---|---|
| **Accumulation error** | `0.1 + 0.2 != 0.3` in floating-point; over thousands of orders, errors compound to real financial discrepancies |
| **Tax calculation errors** | GST rounding requires exact Decimal arithmetic; floating-point rounding gives wrong tax amounts |
| **Change due calculation** | "Paid $20 for $15.73 item" → change should be $4.27; float math might give $4.2700000001 or $4.2699999997 |
| **Audit failures** | Financial audits require exact decimal precision; float math fails audits |

### 7.2.3 The `Money` Value Object Pattern

All money should go through the `Money` value object (`packages/core-domain/src/value_objects/money.rs`), which wraps `rust_decimal::Decimal`:

```rust
use rust_decimal::Decimal;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct Money {
    pub amount: Decimal,
    pub currency: Currency,  // Enum: INR, USD, AED, etc.
}

impl Money {
    /// Create from minor units (cents) - avoids float entirely
    pub fn from_minor_units(amount: i64, currency: Currency) -> Self {
        Money {
            amount: Decimal::from(amount),  // i64 → Exact Decimal
            currency,
        }
    }
    
    /// Add two Money values (exact, no float)
    pub fn add(&self, other: &Self) -> Result<Self, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch);
        }
        Ok(Money {
            amount: self.amount + other.amount,
            currency: self.currency,
        })
    }
    
    /// Multiply by quantity (exact)
    pub fn mul_quantity(&self, quantity: u32) -> Self {
        Money {
            amount: self.amount * Decimal::from(quantity),
            currency: self.currency,
        }
    }
    
    /// Zero money
    pub fn zero(currency: Currency) -> Self {
        Money {
            amount: Decimal::ZERO,
            currency,
        }
    }
}
```

### 7.2.4 Prohibited Patterns (Will Fail Clippy/Lint)

| Anti-Pattern | Why It Fails | Correct Alternative |
|---|---|---|
| `let total: f64 = price * quantity;` | Float imprecision | `let total = Money::from_minor_units(price_cents * quantity)` |
| `let tax = price * 0.05;` | 5% of float is imprecise | `let tax = Money::from_minor_units(price_cents * 5 / 100)` |
| `let change = paid - total;` | Float subtraction error | `change = paid.subtract(&total)` via Money method |
| Storing prices in DB as `REAL`/`FLOAT` | DB float type | Store as `INTEGER` (minor units), convert to `Decimal` in domain |

### 7.2.5 Detection & Enforcement

**Clippy lint** (per `.mise.toml` and `AGENTS.md`):

```bash
cargo clippy --workspace --all-targets -- -D warnings
```

**This will warn/error on**:
- Any `f64`/`f32` used in financial computation context
- Any conversion from float to decimal without explicit `.to_string()` then `Decimal::from_str()`
- Missing `rust_decimal` import where money types are used

**Test coverage** should include:
- Money addition with known exact results (e.g., 10 + 20 = 30 in minor units)
- Money multiplication with quantity
- Rounding edge cases (what happens at .5 boundaries)

**Sample test** (per `core-domain` test patterns):

```rust
#[test]
fn test_money_precision() {
    let ten_dollars = Money::from_minor_units(1000, Currency::USD);  // $10.00
    let twenty_dollars = Money::from_minor_units(2000, Currency::USD);  // $20.00
    
    let total = ten_dollars.add(&twenty_dollars).unwrap();
    
    // Should be exactly $30.00, not $30.000000001
    assert_eq!(total.amount, Decimal::from(3000));
    assert_eq!(total.currency, Currency::USD);
}
```

### 7.2.6 TypeScript Equivalent (per `08_typescript-standards.md` and `AGENTS.md`)

| Rust | TypeScript |
|---|---|
| `rust_decimal::Decimal` | No direct equivalent; use integer-based cents |
| `Money::from_minor_units(1000, USD)` | `Money = { amount: 1000, currency: 'USD' }` (amount stored as cents) |
| Money operations via methods | Functions that operate on `{amount, currency}` objects |
| **Never** use `f64` for money | **Never** use `float` or `any` for money (ESLint `@typescript-eslint/no-explicit-any: error`) |

**TypeScript Pattern** (in `apps/`):

```tsx
// Good: Integer-based cents (no float)
interface Money {
  amount: number;  // Stored as cents (1000 = $10.00)
  currency: 'INR' | 'USD' | 'AED' | ...;
}

// Good: Addition via function (no float math)
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error('Currency mismatch');
  }
  return {
    amount: a.amount + b.amount,  // Integer addition, exact
    currency: a.currency,
  };
}

// Good: Tax calculation via integer math
export function calculateGst(amountCents: number, ratePercent: number): number {
  // (amount * rate) / 100, all integer math
  return Math.round((amountCents * ratePercent) / 100);
}

// Bad: Using f64 / float
const tax = price * 0.05;  // Anti-pattern - float imprecision
```

---

## 7.3 Mandate #3: Hexagonal Core Zero Infrastructure Dependencies

### 7.3.1 Requirement

**Pure domain logic** lives in `packages/core-domain` with **zero infrastructure or async runtime dependencies**. The core crate must compile and run without:
- Database drivers (rusqlite, sqlx, diesel)
- Web frameworks (actix-web, rocket, tide)
- Async runtimes (tokio, async-std) - unless feature-gated for specific functionality
- Cloudflare bindings (worker-rs, D1) - those are in `apps/edge-api`, not `core-domain`

### 7.3.2 What `core-domain` CAN Have (Limited)

| Allowed Dependency | Purpose | Usage |
|---|---|---|
| `rust_decimal` | Financial precision | All Money calculations |
| `serde` + `serde_json` | Serialization/deserialization | For domain events, API DTOs |
| `thiserror` | Error types | Domain-specific error enums |
| `uuid` | ID generation | OrderId, TicketId, etc. |
| `chrono` | Time-stamping | created_at, updated_at, event timestamps |
| `bitflags` | Permission bitmasks | Staff Permissions enum |
| `thiserror` | Error wrapping | Domain errors with context |
| `specta` | TypeScript code generation | For React type bindings |
| `wasm-bindgen` | WASM export | If core-domain exposes WASM APIs |
| `serde-wasm-bindgen` | WASM serialization | Complement to specta |

**What `core-domain` CANNOT Have** (will fail `cargo check` or review):

| Forbidden Dependency | Reason |
|---|---|
| `rusqlite` | Database driver - belongs in adapters |
| `tokio` + async features | Runtime - belongs in edge-api or pos-client |
| `cloudflare::*` | Edge bindings - belongs in edge-api |
| `reactive-streams` | Reactive streams - overkill for domain |
| `hyper` | HTTP server - belongs in edge-api |
| `sqlx` / `diesel` | DB query builders - belongs in adapters |

### 7.3.3 Why This Matters

| Benefit | Explanation |
|---|---|
| **Testability** | Domain tests run in <1s without spinning up databases |
| **Framework Agnostic** | Same core powers Tauri POS, Next.js dashboard, Cloudflare Workers |
| **Binary Size** | No async runtime in core = smaller compilation, faster CI |
| **Security Surface** | Fewer deps = fewer potential vulnerabilities |
| **WASM Compatibility** | Core can be compiled to WASM for edge use cases |

### 7.3.4 Verifying the Mandate

**Run this check** (from monorepo root):

```bash
cargo check -p core-domain
```

**Should succeed** without pulling in any infrastructure deps. If it fails:

1. Check `core-domain/Cargo.toml` for unexpected dependencies
2. Check if any `use` statement brings in a forbidden crate
3. Verify `#![forbid(unsafe_code)]` is present (per mandate #1)
4. Check `[lib]` section doesn't have `dependencies` that are infra

**Example minimal `core-domain/Cargo.toml`** (from codebase exploration):

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
rust_decimal = { workspace = true }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
serde-wasm-bindgen = "0.6.5"
uuid = { workspace = true }
chrono = { workspace = true }
bitflags = { workspace = true }
thiserror = { workspace = true }
specta = { workspace = true }
tsify = "0.5.7"
wasm-bindgen = "0.2.127"

[lints]
workspace = true
```

**Count**: 11 dependencies, none of which are database drivers, async runtimes, or web frameworks.

### 7.3.4 MSix - Verifying by Example

**Check 1**: Does `core-domain` compile standalone?

```bash
cargo check -p core-domain
# Expected: succeeds, shows only the 11 deps above
```

**Check 2**: Does it work without `tokio`?

```bash
# Remove tokio feature, verify still compiles
# (chrono uses "macros, rt" by default in some configs - need to check)
# If chrono has tokio dependency, it must be feature-gated
```

**Check 2 alternative**: Check `chrono` feature flags:

```toml
# In core-domain/Cargo.toml or workspace Cargo.toml
chrono = { workspace = true, features = ["serde"] }  // NO "rt" feature
```

**Check 3**: Does `cargo clippy` pass?

```bash
cargo clippy --workspace --all-targets -- -D warnings
# Should pass with zero warnings, including the unsafe_code deny
```

---

## 7.4 Mandate #4: TypeScript Strict Mode (per `AGENTS.md`)

### 7.4.1 Requirement

Across all JS/TS projects in the monorepo:

- `strict: true` in `tsconfig.json`
- `noImplicitAny: true`
- `@typescript-eslint/no-explicit-any: error` (ESLint rule, treated as error level)
- No `any` type usage anywhere in the codebase

### 7.4.2 Where This Applies

| Project | Config File | Key Settings |
|---|---|---|
| `apps/pos-client` | `tsconfig.json` | `strict: true`, `noImplicitAny: true` |
| `apps/web-dashboard` | `tsconfig.json` | `strict: true`, `noImplicitAny: true` |
| `apps/marketing-site` | `tsconfig.json` | `strict: true` (may be relaxed for marketing-only) |
| `packages/ui-kit` | `tsconfig.json` | `strict: true`, `noImplicitAny: true` |

### 7.4.3 Detection & Enforcement

**Run lint** (per `.mise.toml` tasks):

```bash
pnpm -r lint
```

**This runs** across all packages and will error on:
- Any `use of any` type
- `strict` mode violations (implicit `any`, missing return types)
- `noImplicitAny` violations

**Example violations and fixes**:

| Violation | Error Message | Fix |
|---|---|---|
| `function handle(event: any) {}` | `@typescript-eslint/no-explicit-any: error` | Use specific event type; add proper handler |
| `let x: someVar;` | `noImplicitAny: true` | Annotate type: `let x: string = someVar;` |
| `const obj = {}; obj.foo = 1;` | `strict: true` | `const obj: {foo: number} = {foo: 1};` |
| `function sum(arr: number[]): any { return arr.reduce((a,b) => a + b, 0); }` | `@typescript-eslint/no-explicit-any: error` | Specify return type: `=> number` |

### 7.4.4 Type Patterns (Per `08_typescript-standards.md`)

**Allowed Types**:

```tsx
// Enums for ordered sets
enum OrderStatus { DRAFT, SUBMITTED, IN_PREP, READY, BUMPED, SETTLED }

// Unions for state
type PaymentMethod { Cash | Card | UPI | Wallet }

// Interfaces for objects
interface Money { amount: number; currency: Currency; }

// Type guards for runtime checks
function isOrderSettled(status: OrderStatus): status is 'SETTLED' {
  return status === 'SETTLED';
}
```

**Anti-Patterns (will ESLint error)**:

```tsx
// Never do this - ESLint error
const x = someValue as any;  // explicit any

function process(v: any) {  // any as parameter
  return v.toFixed(2);  // any methods
}

// Never - implicit any
let y = someFunc();  // If someFunc has no return type, y is implicit any - error
```

### 7.4.5 TypeScript Testing Standards

Per `AGENTS.md` Section 4.3:

> **Testing**: `pnpm -r test` runs Vitest across all JS/TS packages.

**Test patterns** (per existing `apps/pos-client/src/App.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders login button', () => {
  render(<App />);
  expect(screen.getByText('Take Order')).toBeInTheDocument();
});
```

**Vitest coverage** (per `package.json`):

```json
"test": "vitest run",
"test:coverage": "vitest run --coverage"
```

Run with:

```bash
pnpm test  # Runs vitest across all packages
pnpm --filter web-dashboard test  # Just dashboard
```

**Tests must not use `any`** - same strict mode applies to test files.

---

## 7.5 Mandate #5: Hexagonal Boundary Enforcement

### 7.5.1 Requirement

No crate/module in the `core-domain` may directly import or depend on infrastructure crates (database, web framework, async runtime). All such dependencies must live in the adapter layer (`apps/` or `packages/` with clear separation).

### 7.5.2 The Boundary Diagram (Reiterate from `04_hexagonal-architecture.md`)

```
+---------------------+          +----------------------+
|  packages/core-domain  |  Uses    |  Infrastructure Adapters  |
|  (Pure Rust Domain)  |  Traits  |  (apps/edge-api,         |
|  Zero infra deps     |  (ports) |   apps/pos-client,      |
|  #![deny(unsafe_code)]|         |   packages/ui-kit)      |
+---------------------+          +----------------------+
         ^                           ^
         |                           |
         | Uses (implements)         | Implemented by
         | traits in                 | SqliteOrderRepository,
         | application services      | D1OrderRepository,
         | (OrderApplicationService  | NetworkEscPosPrinter
         | trait methods)            | etc.
```

### 7.5.2 Verification Checklist

| Check | Expected |
|---|---|
| `cargo tree -p core-domain` | Shows only: `rust_decimal`, `serde`, `uuid`, `chrono`, `bitflags`, `thiserror`, `specta`, `tsify`, `wasm-bindgen` |
| No `use rusqlite;` in `core-domain/src/` | Confirmed via `grep -r "rusqlite" packages/core-domain/src/ --include="*.rs"` |
| No `use worker_rs;` in `core-domain/src/` | Confirmed via `grep -r "worker_rs" packages/core-domain/src/ --include="*.rs"` |
| All DB calls go through repository traits | Yes - see `packages/core-domain/src/ports.rs` |

### 7.5.3 Crossing the Boundary (When Truly Necessary)

If a domain decision genuinely requires infrastructure access, the pattern is:

1. **Add a trait to `core-domain/ports.rs`** - Define what you need (e.g., `fn find_menu_item(&self, id: MenuItemId) -> Result<MenuItem, DbError>`)
2. **Implement the trait in an adapter** - `SqliteOrderRepository` implements the trait using `rusqlite`
3. **Inject the adapter via constructor or method** - Application service receives the trait, doesn't construct it
4. **Test with a mock** - `MockOrderRepository` implements the trait in-memory

**Never** add `rusqlite::Connection` or `worker_rs::Database` directly to a domain struct.

---

## 7.6 Mandate #6: Comprehensive Testing (per `03_testing-workflow.md`)

### 7.6.1 Requirement

All code changes must include appropriate tests. The test suites are:

| Suite | Command | Minimum Threshold |
|---|---|---|
| Rust unit/integration | `cargo test --workspace` | 80% domain logic coverage |
| TypeScript specs | `pnpm -r test` | 70% component coverage |
| API contract | `hurl --test tests/api/**/*.hurl` | 100% of `/api/v1/*` endpoints |
| Clippy lints | `cargo clippy --workspace --all-targets -- -D warnings` | **0 warnings** (treated as errors) |

### 7.6.2 Testing Workflow

**Local development**:

```bash
# 1. Environment
mise trust
pnpm install

# 2. Run Rust tests
mise run test:rust  # cargo test --workspace

# 3. Run TS tests
mise run test:ts  # pnpm -r test

# 4. Run API contract tests
mise run test:api  # hurl --test tests/api/**/*.hurl

# 5. Full suite (blocks CI if any fail)
mise run test  # All three above
```

**CI/CD** (`.github/workflows/ci-dev.yml`):

```yaml
# On every PR:
- uses: actions/checkout@v4
- uses: swornite/mise-action@v2  # Install mise
- run: mise trust  # Lock versions
- run: mise run test  # Full test suite - BLOCKS merge if fails
```

**Failed CI blocks PR merge** into `dev` branch (per `AGENTS.md` branch naming conventions).

### 7.6.3 Test Documentation

Each test file should have a doc-block explaining its purpose, similar to code documentation standards. Example:

```rust
/*
 * Tests for Order aggregate root invariants.
 * 
 * Covers:
 * - Item addition validates seat balance
 * - Discount application respects percentage limits
 * - Settlement requires sufficient payment
 * - Void requires supervisor authorization
 * 
 * Uses MockOrderRepository to avoid DB dependency (hexagonal core).
 * 
 * Run: cargo test --package core-domain -- order::*
 */
```

---

## 7.7 Summary Table: All Mandates

| # | Mandate | Key Requirement | Enforced By |
|---|---|---|---|
| 1 | **Zero Unsafe Code** | `#![deny(unsafe_code)]` at crate root | `cargo build`, `cargo clippy` |
| 2 | **Financial Precision** | `rust_decimal::Decimal` only for money | Clippy, code review, tests |
| 3 | **Hexagonal Core** | Zero infra deps in `core-domain` | `cargo check -p core-domain`, review |
| 4 | **TS Strict Mode** | `strict: true`, `noImplicitAny: error` | `pnpm lint`, ESLint |
| 5 | **Boundary Enforcement** | No infra deps crossing into core | `cargo tree`, `grep` audit |
| 6 | **Comprehensive Testing** | Full test suite must pass | `mise run test`, CI/CD |

---

## 7.8 Next Steps After Understanding Safety Mandates

After reading this file, the recommended progression is:

1. **Run the enforcement checks**:
   ```bash
   cargo clippy --workspace --all-targets -- -D warnings
   cargo check -p core-domain
   # Verify no unsafe, correct decimal usage, etc.
   ```

2. **Explore the codebase for compliance**:
   - `grep -r "#\[deny(unsafe_code)\]" packages/ apps/ --include="*.rs"` - should find all crates
   - `grep -r "rust_decimal" packages/core-domain/src/ --include="*.rs"` - money usage
   - `grep -r "use any" apps/ --include="*.tsx" --include="*.ts"` - should find zero results (or be fixed)
   - `grep -r "use rusqlite" packages/core-domain src/ --include="*.rs"` - should find zero results

3. **Read the actual enforced code**:
   - `packages/core-domain/src/lib.rs` - verify `#![deny(unsafe_code)]` on line 1
   - `packages/core-domain/src/value_objects/money.rs` - verify all money uses Decimal
   - `apps/edge-api/src/lib.rs` - verify JWT auth + tenant isolation patterns
   - `apps/pos-client/src-tauri/src/lib.rs` - verify Tauri + unsafe deny

4. **Run the full check** to see your status:
   ```bash
   mise run lint  # TS lint
   cargo clippy --workspace --all-targets -- -D warnings  # Rust lint
   ```

5. **Read** `08_typescript-standards.md` for the TypeScript-side equivalents and how they integrate.

---

## 7.9 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - safety mandates overview |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new mandate additions |

---
*This file is part of the PlinthOS internal developer documentation set. See `06_domain-modeling-patterns.md` for the DDD models these mandates govern, `04_hexagonal-architecture.md` for the structural pattern, and `AGENTS.md` for the source of truth governing all project conventions.*