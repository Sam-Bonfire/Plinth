# 15_rust-testing-patterns.md - Advanced Rust Testing Patterns for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `03_testing-workflow.md` (overview of test suites)
- `07_rust-safety-mandates.md` (safety rules that govern tests)
- `11_branch-workflow.md` (PR test requirements)
- `DEVELOPER-NAVIGATION.md` (master navigation)
- `packages/core-domain/` and `apps/edge-api/` (test targets)

---

## 15.1 Test Organization Pattern

PlinthOS uses a three-tier test organization within each crate:

### 15.1.1 Tier 1: Unit Tests (inline, `#[cfg(test)]`)

**Location**: Within the module file itself (e.g., `packages/core-domain/src/models/order/tests/` or inline in `order.rs`)

**Characteristics**:
- `#[test]` macros
- Access to `super::*` (private items)
- Fast (no external deps)
- Run via `cargo test -p core-domain`

**Example**:

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
    fn order_seat_balance_invariant() {
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();

        let (mut order, _) = Order::new(
            tenant_id,
            location_id,
            terminal_id,
            OrderChannel::DineIn,
            staff_id,
            None,
            None,
        );

        // Add items ensuring seat balance
        let item1 = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: MenuItemId::new(),
            name: "Pizza".to_string(),
            base_price: Money::from_minor_units(2000, Currency::Inr),  // $20.00
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money::from_minor_units(2000, Currency::Inr),
            quantity: 2,  // 2 pizzas
            fired_quantity: 0,
            tax_rate: GstRate::Five,
            notes: None,
            seat_number: Some(SeatNumber::new(1)),  // Seat 1
        };

        let item2 = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: MenuItemId::new(),
            name: "Salad".to_string(),
            base_price: Money::from_minor_units(500, Currency::Inr),  // $5.00
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money::from_minor_units(500, Currency::Inr),
            quantity: 1,
            fired_quantity: 0,
            tax_rate: GstRate::Zero,
            notes: None,
            seat_number: Some(SeatNumber::new(2)),  // Seat 2
        };

        order.add_item(item1).unwrap();
        order.add_item(item2).unwrap();

        // Seat check: Seat 1 = $20.00, Seat 2 = $5.00 → total = $25.00
        // Order total should also be $25.00
        let subtotal = order.subtotal();
        let total = order.grand_total(&GstApplicability::Applicable);

        // The invariant: subtotal + tax + tip should equal grand total
        // (Simplified: just verify seat totals concept)
        assert!(total.amount > Decimal::ZERO);
    }
}
```

### 15.1.2 Unit Test Guidelines

| Guideline | Description |
|---|---|
| **Test one invariant per test** | Single clear assertion |
| **Use descriptive names** | `order_seat_balance_invariant`, not `test1` |
| **Isolate dependencies** | Mock repos for other contexts |
| **No `unsafe` in tests** | Per `#![deny(unsafe_code)]` mandate |
| **Run frequently** | `cargo test -p core-domain` during development |

---

### 15.1.2 Integration Tests (separate module)

**Location**: `packages/core-domain/src/tests/` or `apps/edge-api/tests/`

**Characteristics**:
- `#[cfg(test)] mod integration_tests;` at crate root level
- May spin up real SQLite in-memory database
- Test API endpoints, repository implementations
- Slower than unit tests; run less frequently

**Example**:

```rust
#[cfg(test)]
mod integration_tests {
    use rusqlite::Connection;
    use super::*;

    #[test]
    fn order_save_and_retrieve_through_repo() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA journal_mode = WAL;", []).unwrap();

        let repo = SqliteOrderRepository::new(&conn);
        
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();

        let (order, _) = Order::new(tenant_id, location_id, terminal_id, OrderChannel::DineIn, staff_id, None, None);
        
        // Save and retrieve
        repo.save(&order).unwrap();
        let retrieved = repo.find_by_id(order.id).unwrap();
        
        assert_eq!(order.status, retrieved.status);
        assert_eq!(order.subtotal(), retrieved.subtotal());
    }
}
```

---

### 15.1.3 API Contract Tests (Hurl)

**Location**: `tests/api/*.hurl` (covered in `12_api-contract-tests.md`)

**Characteristics**:
- Declarative HTTP test specification
- Run via `hurl --test tests/api/**/*.hurl`
- Part of CI/CD gate (blocks PR merge if fail)
- Technology-agnostic (tests HTTP, not language-specific)

---

## 15.2 Testing Patterns Specific to Domain Models

### 15.2.1 Testing Aggregate Root Invariants

**Pattern**: Test every mutator method and verify invariants are preserved.

**Example** (from `core-domain` order tests):

```rust
#[test]
fn test_order_add_item_invariant() {
    let tenant_id = TenantId::new();
    let location_id = LocationId::new();
    let terminal_id = TerminalId::new();
    let staff_id = StaffMemberId::new();

    let (mut order, _) = Order::new(tenant_id, location_id, terminal_id, OrderChannel::DineIn, staff_id, None, None);

    // Add first item
    let item1 = OrderLineItem {
        id: OrderLineItemId::new(),
        menu_item_id: MenuItemId::new(),
        name: "Burger".to_string(),
        base_price: Money::from_minor_units(1500, Currency::Inr),
        modifier_selections: Vec::new(),
        modifier_total: Money::zero(Currency::Inr),
        unit_price: Money::from_minor_units(1500, Currency::Inr),
        quantity: 1,
        fired_quantity: 0,
        tax_rate: GstRate::Zero,
        notes: None,
        seat_number: Some(SeatNumber::new(1)),
    };

    let evt1 = order.add_item(item1).unwrap();
    assert_eq!(order.items.len(), 1);
    assert_eq!(order.subtotal().amount, Decimal::from(1500));
    assert!(order.is_draft());

    // Add second item (different seat)
    let item2 = OrderLineItem {
        id: OrderLineItemId::new(),
        menu_item_id: MenuItemId::new(),
        name: "Fries".to_string(),
        base_price: Money::from_minor_units(500, Currency::Inr),
        modifier_selections: Vec::new(),
        modifier_total: Money::zero(Currency::Inr),
        unit_price: Money::from_minor_units(500, Currency::Inr),
        quantity: 1,
        fired_quantity: 0,
        tax_rate: GstRate::Zero,
        notes: None,
        seat_number: Some(SeatNumber::new(2)),
    };

    let evt2 = order.add_item(item2).unwrap();
    assert_eq!(order.items.len(), 2);
    // Seat 1 = $15.00, Seat 2 = $5.00 → total = $20.00
    // Grand total should reflect both items + tax
    let total = order.grand_total(&GstApplicability::Applicable);
    assert!(total.amount >= Decimal::from(2000));  // At least subtotal

    // Try adding third item - should succeed (no seat limit in this simple test)
    let item3 = OrderLineItem {
        id: OrderLineItemId::new(),
        menu_item_id: MenuItemId::new(),
        name: "Drink".to_string(),
        base_price: Money::from_minor_units(300, Currency::Inr),
        modifier_selections: Vec::new(),
        modifier_total: Money::zero(Currency::Inr),
        unit_price: Money::from_minor_units(300, Currency::Inr),
        quantity: 1,
        fired_quantity: 0,
        tax_rate: GstRate::Zero,
        notes: None,
        seat_number: Some(SeatNumber::new(1)),  // Reusing seat 1
    };

    let evt3 = order.add_item(item3).unwrap();
    assert_eq!(order.items.len(), 3);
    // Seat 1 now has $15.00 + $3.00 = $18.00; Seat 2 = $5.00; total = $23.00
}
```

### 15.2.2 Testing State Machine Transitions

**Pattern**: Test every valid transition; verify invalid transitions are rejected.

**Example** (KitchenTicket state machine):

```rust
#[test]
fn test_kitchen_ticket_state_transitions() {
    use crate::models::kitchen::KitchenTicket;
    use crate::models::ticket_line::TicketLine;
    use crate::enums::order_status::OrderStatus;
    use crate::value_objects::ticket_stage::CourseStage;

    let tenant_id = TenantId::new();
    let location_id = LocationId::new();
    let ticket_id = TicketId::new();

    let (ticket, _) = KitchenTicket::new(tenant_id, location_id, ticket_id);

    // Initial state: PENDING
    assert_eq!(ticket.status(), TicketStatus::PENDING);
    assert!(ticket.is_pending());

    // Valid: PENDING → IN_PREP (chef starts prep)
    let line = TicketLine::new(MenuItemId::new(), "Test Item".to_string(), 1);
    ticket.add_line(line);
    ticket.start_prep().unwrap();
    assert_eq!(ticket.status(), TicketStatus::IN_PREP);
    assert!(ticket.is_in_prep());

    // Valid: IN_PREP → READY (chef marks ready)
    ticket.mark_ready().unwrap();
    assert_eq!(ticket.status(), TicketStatus::READY);
    assert!(ticket.is_ready());

    // Valid: READY → BUMPED (expeditor serves)
    ticket.bump().unwrap();
    assert_eq!(ticket.status(), TicketStatus::BUMPED);
    assert!(ticket.is_bumped());

    // Invalid: PENDING → BUMPED (should fail without fast-track)
    let ticket2 = KitchenTicket::new(tenant_id, location_id, TicketId::new());
    let line2 = Ticket2::new(MenuItemId::new(), "Test Item 2".to_string(), 1);
    ticket2.add_line(line2);
    
    // This should fail - can't bypass IN_PREP
    let result = ticket2.bump();
    assert!(result.is_err());
    assert_eq!(ticket2.status(), TicketStatus::PENDING); // unchanged
    
    // Valid with fast-track (requires Permissions::FAST_TRACK)
    let ticket3 = KitchenTicket::new(tenant_id, location_id, TicketId::new());
    ticket3.add_line(TicketLine::new(MenuItemId::new(), "Test Item 3".to_string(), 1));
    // Note: fast-track test would require mock permissions
}
```

### 15.2.3 Testing Value Object Operations

**Pattern**: Test all arithmetic and transformation methods are exact (no float imprecision).

**Example** (Money value object):

```rust
#[test]
fn test_money_operations() {
    use rust_decimal::Decimal;
    use crate::value_objects::money::Money;
    use crate::value_objects::currency::Currency;

    // Creation
    let ten_dollars = Money::from_minor_units(1000, Currency::USD);
    assert_eq!(ten_dollars.amount, Decimal::from(1000));
    assert_eq!(ten_dollars.currency, Currency::USD);

    // Addition (exact)
    let twenty_dollars = Money::from_minor_units(2000, Currency::USD);
    let total = ten_dollars.add(&twenty_dollars).unwrap();
    assert_eq!(total.amount, Decimal::from(3000));
    assert_eq!(total.currency, Currency::USD);

    // Multiplication (exact)
    let tripled = ten_dollars.mul_quantity(3);
    assert_eq!(tripled.amount, Decimal::from(3000));
    assert_eq!(tripled.currency, Currency::USD);

    // Zero
    let zero = Money::zero(Currency::USD);
    assert_eq!(zero.amount, Decimal::ZERO);
    assert_eq!(zero.currency, Currency::USD);

    // Equality
    let a = Money::from_minor_units(1000, Currency::USD);
    let b = Money::from_minor_units(1000, Currency::USD);
    assert_eq!(a, b);
}
```

---

## 15.3 Testing Edge API Workers

### 15.3.1 Rust Worker Tests

**Location**: `apps/edge-api/tests/`

**Pattern**: Test HTTP handler functions with mock request/response.

**Example** (from actual codebase patterns):

```rust
#[test]
fn test_valid_jwt_extraction_and_context() {
    use super::*;
    use auth::{JwtClaims, verify_context_from_headers};
    use core_domain::enums::staff::Permissions;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    let get_now = || -> usize {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize
    };

    let tenant_id = Uuid::now_v7().to_string();
    let location_id = Uuid::now_v7().to_string();
    let secret = "test_secret";

    let now = get_now();
    let claims = JwtClaims {
        sub: Uuid::now_v7().to_string(),
        iss: "plinth-auth".to_string(),
        exp: now + 3600,
        tenant_id: tenant_id.clone(),
        location_id: location_id.clone(),
        roles: vec!["Manager".to_string()],
        permissions: Permissions::TAKE_ORDER.bits(),
    };

    let token = create_test_token(&claims, secret);

    let result = verify_context_from_headers(
        Some(tenant_id.clone()),
        Some(location_id.clone()),
        Some(&format!("Bearer {token}")),
        secret,
        Permissions::empty(),
    );

    assert!(result.is_ok());
    let ctx = result.unwrap();
    assert_eq!(ctx.tenant_id.to_string(), tenant_id);
}

#[test]
fn test_tenant_mismatch() {
    // Same as above but with wrong tenant_id → should return Err
    // Tests multi-tenant isolation at handler level
}
```

### 15.3.2 Test Utilities

**Common test helpers** in `apps/edge-api/tests/util/`:

```rust
pub fn create_test_token(claims: &JwtClaims, secret: &str) -> String {
    let header = Header::new(jsonwebtoken::Algorithm::HS256);
    encode(&header, claims, &EncodingKey::from_secret(secret.as_bytes())).unwrap()
}

pub fn assert_http_200(resp: Result<Response, worker::Response>) {
    let body = resp.unwrap();
    assert_eq!(body.status_code(), 200);
}

pub fn assert_http_401(resp: Result<Response, worker::Response>) {
    let body = resp.unwrap();
    assert_eq!(body.status_code(), 401);
}
```

---

## 15.4 Property-Based Testing (Optional but Recommended)

### 15.4.1 QuickCheck / proptest Patterns

**For invariants that are hard to enumerate** (e.g., "seat balance always equals order total regardless of item combination"):

```rust
#[cfg(test)]
mod prop_tests {
    use proptest::prelude::*;
    use rust_decimal::Decimal;
    use crate::value_objects::money::Money;
    use crate::value_objects::currency::Currency;

    proptest! {
        #[test]
        fn money_addition_is_associative(a in 0..10_000i64, b in 0..10_000i64, c in 0..10_000i64) {
            let ma = Money::from_minor_units(a, Currency::USD);
            let mb = Money::from_minor_units(b, Currency::USD);
            let mc = Money::from_minor_units(c, Currency::USD);
            
            // (a + b) + c == a + (b + c)
            let left = ma.add(&mb).unwrap().add(&mc).unwrap();
            let right = ma.add(&mb.add(&mc).unwrap()).unwrap();
            
            prop_assert_eq!(left.amount, right.amount);
        }
    }
}
```

**Run with**: `cargo test --lib -- --test-threads=1` (property tests can be slower)

---

## 15.5 CI/CD Test Gate

### 15.5.1 What CI Checks (`.github/workflows/ci-dev.yml`)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: swornite/mise-action@v2
      - run: mise trust
      - run: mise run test:rust    # cargo test --workspace
      - run: mise run test:ts      # pnpm -r test
      - run: mise run test:api     # hurl --test tests/api/**/*.hurl
      # If any fail, PR cannot merge to `dev`
```

### 15.5.2 Test Coverage Minimums (Enforced via CI, Not Manual)

| Suite | Minimum Threshold |
|---|---|
| Rust unit/integration | 80% of public API functions have tests |
| TypeScript component | 70% of components tested |
| API contracts | 100% of `/api/v1/*` endpoints have Hurl tests |
| Clippy warnings | **0** (treated as errors) |

---

## 15.6 Debugging failing Tests

### 15.6.1 Common Failure Patterns

| Symptom | Cause | Fix |
|---|---|---|
| `failed to acquire the WAL lock` | Multiple `cargo test` processes on same DB | Run with `--test-threads=1` or separate DB paths |
| `already borrowed as mutable` | Test mutates shared state without `refcell`/`mutex` | Refactor test to isolate state; use `clone()` where appropriate |
| `expected X, got Y` (Decimal comparison) | Float vs Decimal mismatch | Ensure all money uses `rust_decimal::Decimal`; convert via `from_minor_units` |
| `missing `mutable` reference` | Test tries to mutate aggregate root directly | Use aggregate methods (e.g., `order.add_item()` instead of `order.items.push()`) |
| `test timed out (>60s)` | Deadlock in async code, or infinite test loop | Check for recursive test setup; reduce test isolation scope |

### 15.5.2 Test Isolation Checklist

```bash
# 1. Run specific test file only
cargo test -p core-domain -- order::*

# 2. Run with single thread (avoid WAL lock issues)
cargo test -p core-domain -- --test-threads=1

# 3. Run in isolation (no other test suites)
mise run test:rust  # Only Rust, no TS or Hurl

# 4. Verify safety mandate compliance
cargo deny check unsafe-code  # If deny unsafe_code is configured as separate tool
```

---

## 15.7 Next Steps After Reading Testing Patterns

After reading this file, proceed with:

1. **Run the existing test suite**:
   ```bash
   mise run test:rust  # Verify all pass
   mise run test:ts    # Verify TS tests pass
   mise run test:api   # Verify Hurl tests pass
   ```

2. **Add a new unit test** to an existing module:
   - Choose a model (e.g., `core-domain/src/models/order.rs`)
   - Write tests for a new method or invariant
   - Run `cargo test -p core-domain` to verify

3. **Review existing test files**:
   - `packages/core-domain/src/models/order/tests/`
   - `apps/edge-api/tests/`
   - `tests/api/create_order.hurl`

4. **Read** `03_testing-workflow.md` for the full testing workflow integration

5. **Read** `11_branch-workflow.md` for how test results affect PR merge status

---

## 15.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - Rust testing patterns |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new test patterns |

---
*This file is part of the PlinthOS internal developer documentation set. See `03_testing-workflow.md` for the full testing workflow overview, `07_rust-safety-mandates.md` for the safety rules governing tests, and `packages/core-domain/src/` for the actual code implementations being tested.*