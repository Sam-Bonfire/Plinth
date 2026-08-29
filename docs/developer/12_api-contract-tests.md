# 12_api-contract-tests.md - Hurl API Contract Testing for PlinthOS

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `03_testing-workflow.md` (testing workflow overview - prerequisite)
- `04_hexagonal-architecture.md` (API routes fit into hexagonal structure)
- `09_contributing-guide.md` (PR requirements include contract tests)
- `tests/api/` (actual .hurl test files)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 12.1 Hurl Test Overview

**Hurl** is a declarative API test framework used throughout PlinthOS to verify endpoint contracts. Test files use the `.hurl` extension and specify:

- HTTP method and URL
- Request headers (including authentication)
- Request body (JSON)
- Expected response status codes
- JSONPath assertions on response body

All public `/api/v1/*` endpoints must have corresponding Hurl tests.

### 12.1.1 Hurl Test Location

```
tests/api/
├── create_order.hurl
├── get_kds_tickets.hurl
└── z_report_close.hurl
```

### 12.1.2 Running Hurl Tests

```bash
# Full API test suite
mise run test:api

# Equivalent manual command
hurl --test tests/api/**/*.hurl
```

### 12.1.3 Hurl in CI/CD

The GitHub Actions CI (`.github/workflows/ci-dev.yml`) runs `mise run test:api` on every PR. All API contract tests must pass for the PR to be merged into `dev` branch.

---

## 12.2 Hurl Test Syntax

### 12.2.1 Basic Structure

```hurl
# Request line + headers + body
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

### 12.2.2 Hurl Test Components

| Component | Syntax | Description |
|---|---|---|
| **Request line** | `METHOD URL` | HTTP method + base URL |
| **Headers** | `Header "Name: value"` | Custom headers (auth, store ID, etc.) |
| **Body** | `{ JSON }` | Request body (JSON format) |
| **Status** | `HTTP 201` | Expected response status code |
| **Assertions** | `[Asserts]` block | JSONPath assertions on response |

### 12.2.2.1 HTTP Status Assertion

```hurl
HTTP 201    # Must return 201 Created
HTTP 401    # Must return 401 Unauthorized
HTTP 403    # Must return 403 Forbidden
HTTP 500    # Must return 500 Internal Server Error
```

### 12.2.2.2 JSONPath Assertions

```hurl
[Asserts]
# Exact equality
jsonpath "$.status" == "SUCCESS"

# Inequality / comparison
jsonpath "$.data.total_cents" > 0

# Array length
jsonpath "$.data.items" count > 0

# String contains
header "Content-Type" contains "application/json"

# Nested path
jsonpath "$.data.order.items[0].name" == "Butter Chicken"

# Multiple assertions in one block
jsonpath "$.status" == "SUCCESS"
jsonpath "$.data.order_id" == "ord_100982"
jsonpath "$.data.payment.method" == "CARD"
```

---

## 12.3 Common API Test Patterns

### 12.3.1 Authentication Pattern

All `/api/v1` endpoints (except `/api/v1/auth/*`) require valid JWT authentication.

**Hurl test template**:

```hurl
# Authenticated request
GET http://localhost:8787/api/v1/orders
Header "Content-Type: application/json"
Header "X-Store-Id: store_01"
Header "Authorization: Bearer ${{TEST_JWT_TOKEN}}"

HTTP 200
[Asserts]
jsonpath "$.data" count > 0
jsonpath "$.status" == "SUCCESS"
```

**Generating test JWT** (outside Hurl, in test setup):

```bash
# Using the test utilities in edge-api
cargo test --test jwt_generation -- --test-threads=1
# Or generate via: tools/jwt_generator.sh
```

### 12.3.2 Tenant Isolation Pattern

Every query mandatorily binds `tenant_id` and `location_id`:

```hurl
GET http://localhost:8787/api/v1/kds/tickets
Header "Content-Type: application/json"
Header "X-Store-Id: store_01"
Header "X-Tenant-Id: tenant_99"

HTTP 200
[Asserts]
jsonpath "$.data" count > 0
# All returned tickets belong to this tenant
jsonpath "$.data[0].tenant_id" == "tenant_99"
```

### 12.3.3 Order Creation Pattern

**Full order creation test** (from `tests/api/create_order.hurl`):

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

### 12.3.4 KDS Ticket Probe Pattern

```hurl
# List active KDS tickets
GET http://localhost:8787/api/v1/kds/tickets
Header "Content-Type: application/json"
Header "X-Store-Id: store_loc_99"

HTTP 200
[Asserts]
# Must have at least one ticket
jsonpath "$.data" count > 0
# First ticket has expected station
jsonpath "$.data[0].station_id" == "GRILL_01"
# Status should be PENDING for newly submitted orders
jsonpath "$.data[0].status" == "PENDING"
# Ticket should have order reference
jsonpath "$.data[0].order_id" != ""  # non-empty string
```

### 12.3.5 Z-Report Close Pattern

```hurl
# Close shift and generate Z-Report
POST http://localhost:8787/api/v1/eod/shift/close
Header "Content-Type: application/json"
Header "X-Store-Id: store_loc_99"
Header "Authorization: Bearer admin_jwt_token"
{
  "shift_id": "sh_20260828_1",
  "expected_cash": 500.00,
  "submit": true
}

HTTP 200
[Asserts]
jsonpath "$.status" == "SUCCESS"
jsonpath "$.data.z_report_id" != ""  # non-empty generated ID
jsonpath "$.data.total_revenue" > 0
jsonpath "$.data.cash_summary.total" > 0
```

---

## 12.4 Writing New Hurl Tests

### 12.4.1 Test Development Workflow

1. **Identify the endpoint** to test (new feature or existing)
2. **Determine auth requirements** (JWT, X-Store-Id, X-Tenant-Id)
3. **Write the .hurl file** in `tests/api/`
4. **Run locally**: `hurl --test tests/api/new_endpoint.hurl`
5. **Add to CI** (automatic via PR - CI runs `mise run test:api`)
6. **Update documentation** if endpoint changes significantly

### 12.4.2 Hurl Test File Checklist

| Check | Pass/Fail |
|---|---|
| File saved as `.hurl` extension | |
| Request line method + URL correct | |
| Authentication headers present (if required) | |
| Request body JSON valid (if POST/PUT/PATCH) | |
| HTTP status assertion present | |
| At least 2 JSONPath assertions | (minimum coverage) |
| All `/api/v1` endpoints have a test | (CI will flag gaps) |
| Test name/description meaningful | |

### 12.4.3 Testing Tips

| Tip | Description |
|---|---|
| **Use environment variables** for URLs/tokens | Makes tests portable (local/CI/prod) |
| **Group related assertions** in `[Asserts]` block | Easier to read/debug failed tests |
| **Test both success and error cases** | e.g., test 201 for valid, test 401 for missing auth |
| **Use data fixtures** for repeated JSON bodies | Store in separate file, reference in Hurl |
| **Run tests before PR** | `mise run test:api` should pass locally before pushing |

---

## 12.5 Hurl Test Maintenance

### 12.5.1 When to Update a Hurl Test

Update when:

| Change Type | Action |
|---|---|
| **Endpoint URL changes** | Update the URL line |
| **Response schema changes** | Update JSONPath assertions |
| **New required headers** | Add Header lines |
| **New response fields** | Add new jsonpath assertions |
| **Deprecated endpoint** | Mark as `@deprecated` in comment, or remove after deprecation period |

### 12.5.2 Deprecating a Hurl Test

```hurl
# Deprecated: Old order creation endpoint (replaced by v2)
# https://github.com/plinthos/plinthos/issues/432

# Old endpoint (no longer tested)
# POST http://localhost:8787/api/v1/orders/legacy

# New endpoint (tested instead)
POST http://localhost:8787/api/v1/orders
```

---

## 12.6 Hurl Test Examples Repository

**Complete test suite** lives in `tests/api/`. Here's the current set:

| Test File | Purpose | Key Assertions |
|---|---|---|
| `create_order.hurl` | Order creation endpoint | 201, status=SUCCESS, total_cents, sync_status=SETTLED |
| `get_kds_tickets.hurl` | List KDS tickets | data count > 0, station_id, status=PENDING |
| `z_report_close.hurl` | Shift close / EOD | status=SUCCESS, z_report_id, total_revenue, cash_summary |

**Each test** includes:
- Proper authentication headers
- Store ID isolation
- Comprehensive JSONPath assertions
- Meaningful error messages on failure

---

## 12.7 Next Steps After Understanding Hurl Tests

After reading this file, proceed with:

1. **Run the existing test suite**:
   ```bash
   mise run test:api
   # Verify all 3 tests pass
   ```

2. **Review existing test files**:
   - `tests/api/create_order.hurl`
   - `tests/api/get_kds_tickets.hurl`
   - `tests/api/z_report_close.hurl`

3. **Write a new test** for an endpoint you're modifying:
   - Identify the endpoint and its auth requirements
   - Write the `.hurl` file following the patterns above
   - Run `hurl --test tests/api/new_test.hurl` to verify
   - Commit with Conventional Commits (see `10_commit-message-format.md`)

4. **Read** `03_testing-workflow.md` for the full testing workflow integration

5. **Read** `11_branch-workflow.md` for branch/PR integration of test changes

---

## 12.8 Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - Hurl API contract testing |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on contributor feedback |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new test patterns |

---
*This file is part of the PlinthOS internal developer documentation set. See `03_testing-workflow.md` for the full testing workflow, `09_contributing-guide.md` for PR requirements, and `tests/api/` for the actual test files.*