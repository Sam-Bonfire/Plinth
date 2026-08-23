# PlinthOS: Enterprise Restaurant Operating System

> **Classification**: System Architecture Specification & Engineering Source of Truth  
> **Target Architecture**: Offline-First, Local-First, Hexagonal, Domain-Driven Design (DDD)

---

## 1. Executive Summary & Core Architectural Mandates

PlinthOS is an enterprise-grade, Bring-Your-Own-Device (BYOD) Restaurant Point of Sale (POS), Kitchen Display System (KDS), and Back-of-House (BOH) management platform. It is engineered specifically for high-stress operational environments ranging from high-density Quick Service Restaurants (QSR) and multi-zone fine dining establishments to complex food halls.

### Core Architecture Pillars

- **Domain-Driven Design (DDD)**: Strategic design bounded contexts (`Ordering`, `KitchenExecution`, `InventoryCore`, `TenantBilling`) with explicit Aggregate Roots, Value Objects, Domain Events, and State Transition Invariants.
- **Hexagonal Architecture (Ports & Adapters)**: Isolated pure Rust domain core (`packages/core-domain`) surrounded by Inbound Adapters (Tauri IPC commands, Cloudflare Workers, Hurl tests) and Outbound Adapters (`rusqlite`, Cloudflare Durable Objects / D1, raw TCP ESC/POS sockets).
- **Rust Local Engine Execution**: All state mutations, calculations, local persistence, network socket streaming, and background sync queues run in compiled, multi-threaded Rust (`tokio` async runtime). React serves exclusively as an unprivileged, reactive rendering shell.
- **Declarative API Verification**: Automated contract and integration testing via Hurl (`.hurl`) files to test edge API workers, JSON response schemas, and WebSocket handshakes directly in CI/CD.
- **Deterministic Workspaces via mise**: Tooling, toolchain versions, and task orchestration are managed strictly via `mise`.

---

## 2. Bounded Context Map (Domain-Driven Design)

The system is decomposed into four strict Bounded Contexts, each maintaining its own Ubiquitous Language, Aggregate Roots, and invariants.

```mermaid
graph TD
    subgraph CoreDomain["packages/core-domain (Pure Rust Core)"]
        subgraph OrderingContext["Ordering Context"]
            Order[Aggregate Root: Order]
            OrderLineItem[Entity: OrderLineItem]
            SeatNumber[Value Object: SeatNumber]
            ModifierSelection[Value Object: ModifierSelection]
            Money[Value Object: Money Decimal]
            
            Order --> OrderLineItem
            OrderLineItem --> SeatNumber
            OrderLineItem --> ModifierSelection
            OrderLineItem --> Money
        end

        subgraph KDSContext["Kitchen Execution Context"]
            KitchenTicket[Aggregate Root: KitchenTicket]
            TicketLine[Entity: TicketLine]
            StationId[Value Object: StationId]
            SLA[Value Object: PreparationSLA]
            CourseStage[Value Object: CourseStage]

            KitchenTicket --> TicketLine
            KitchenTicket --> StationId
            KitchenTicket --> SLA
            KitchenTicket --> CourseStage
        end

        subgraph InventoryContext["Inventory Core Context"]
            StockItem[Aggregate Root: StockItem]
            Recipe[Entity: Recipe]
            UnitQty[Value Object: UnitQty]
            StockDelta[Value Object: StockDelta]

            StockItem --> Recipe
            StockItem --> UnitQty
            StockItem --> StockDelta
        end

        subgraph BillingContext["Tenant & Billing Context"]
            StoreShift[Aggregate Root: StoreShift]
            ZReport[Entity: ZReport]
            TaxLiability[Value Object: TaxLiability]
            TenderBreakdown[Value Object: TenderBreakdown]

            StoreShift --> ZReport
            StoreShift --> TaxLiability
            StoreShift --> TenderBreakdown
        end
    end

    OrderingContext -- "Emits ORDER_SUBMITTED" --> KDSContext
    OrderingContext -- "Emits ORDER_SUBMITTED" --> InventoryContext
    OrderingContext -- "Emits CHECK_SETTLED" --> BillingContext
```

### Context Invariants & Validation Rules

- **Ordering Context**: Price calculations must strictly utilize `rust_decimal::Decimal` (no IEEE-754 floating-point arithmetic permitted). Seat totals must balance: $\sum (\text{Seat Check Totals}) = \text{Order Total}$.
- **Kitchen Execution Context**: A ticket line cannot transition to `BUMPED` before transitioning to `IN_PREP` (unless explicitly fast-tracked by an authorized role policy).
- **Inventory Context**: Recipe stock deduction occurs automatically upon receiving an `ORDER_SUBMITTED` domain event. Stock drops below minimum reorder thresholds emit an `INVENTORY_DISCREPANCY_ALERT`.
- **Tenant Context**: A shift cannot be closed (`Z-REPORT`) if active open checks remain associated with its register.

---

## 3. Hexagonal Architecture Flowchart (Ports & Adapters)

```mermaid
flowchart TD
    subgraph InboundAdapters["Inbound Adapters (Drivers)"]
        A1["Tauri v2 IPC Commands (React Shell)"]
        A2["Cloudflare Worker WASM Routing"]
        A3["Hurl API Contract Test Harness"]
    end

    subgraph InboundPorts["Inbound Ports (Application Services)"]
        IP1["OrderApplicationService Trait"]
        IP2["KitchenApplicationService Trait"]
        IP3["InventoryApplicationService Trait"]
    end

    subgraph DomainCore["Pure Rust Domain Core (Zero Infrastructure Dependencies)"]
        DC1["Order Aggregate & Invariants"]
        DC2["KitchenTicket State Machine"]
        DC3["Recipe Inventory Calculator"]
    end

    subgraph OutboundPorts["Outbound Ports (Repository & Gateway Traits)"]
        OP1["OrderRepository Trait"]
        OP2["PrintGateway Trait"]
        OP3["RemoteSyncGateway Trait"]
    end

    subgraph OutboundAdapters["Outbound Adapters (Driven)"]
        OA1["SqliteOrderRepository (rusqlite / WAL)"]
        OA2["NetworkEscPosPrinter (TcpStream Sockets)"]
        OA3["CloudflareDurableObjectAdapter (WebSockets)"]
        OA4["CloudflareD1Repository (Serverless SQLite)"]
    end

    A1 --> IP1
    A2 --> IP1
    A3 --> IP1

    IP1 --> DC1
    IP2 --> DC2
    IP3 --> DC3

    DC1 --> OP1
    DC1 --> OP2
    DC2 --> OP3

    OP1 --> OA1
    OP2 --> OA2
    OP3 --> OA3
    OP1 --> OA4
```

---

## 4. Execution Sequence: Local Write & Background Edge Synchronization

This diagram demonstrates how local SSD writes complete in $<1\text{ms}$ while Tokio handles async network replication in the background.

```mermaid
sequenceDiagram
    autonumber
    actor Cashier
    participant React as React 18 UI (Unprivileged)
    participant Tauri as Tauri IPC (Rust Core)
    participant SQLite as Local rusqlite DB (WAL Mode)
    participant Printer as Network Thermal Printer
    participant Tokio as Tokio Async Sync Daemon
    participant DO as Cloudflare Durable Object (Edge)

    Cashier->>React: Taps "Submit & Print Order"
    React->>Tauri: invoke("submit_order", order_payload)
    
    rect rgb(240, 253, 244)
        note right of Tauri: Synchronous Local Transaction Block (<1ms)
        Tauri->>SQLite: BEGIN TRANSACTION
        Tauri->>SQLite: INSERT INTO orders ...
        Tauri->>SQLite: INSERT INTO sync_queue (status = 'PENDING') ...
        Tauri->>SQLite: COMMIT
    end

    Tauri-->>React: Return OrderReceipt Struct
    React-->>Cashier: UI Clears & Renders Optimistic State (<1ms)

    par Non-blocking Background Socket I/O
        Tauri->>Printer: Async TcpStream ::connect(192.168.1.100:9100)
        Printer-->>Tauri: ESC/POS Raw Byte Stream Written
    and Background Replication Loop
        Tauri->>Tokio: Signal Channel (order_id)
        Tokio->>SQLite: SELECT * FROM sync_queue WHERE status = 'PENDING'
        Tokio->>DO: WebSocket Frame (JSON Mutation)
        DO-->>Tokio: Ack Frame (Settled)
        Tokio->>SQLite: UPDATE sync_queue SET status = 'SETTLED'
    end
```

---

## 5. KDS Ticket Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING : Order Submitted

    state PENDING {
        [*] --> SLA_GREEN : Timer < 8m
        SLA_GREEN --> SLA_YELLOW : Timer 8m - 12m
        SLA_YELLOW --> SLA_RED : Timer > 15m
    }

    PENDING --> IN_PREP : Chef Taps "Start Prep"
    IN_PREP --> READY : Chef Taps "Mark Ready"
    READY --> BUMPED : Expeditor Taps "Bump / Serve"
    
    PENDING --> CANCELLED : Void / Order Cancelled
    IN_PREP --> CANCELLED : Void / Manager Override
    
    BUMPED --> [*]
    CANCELLED --> [*]
```

---

## 6. Strict Technology Stack & Version Matrix

All crates, NPM packages, and toolchains are strictly version-locked.

### A. Development Toolchain & Task Orchestration

- **Task & Environment Engine**: `mise` (Tool version manager + Task runner).
- **Workspace Engine**: Cargo Workspaces (Rust) + pnpm Workspaces (JS/TS).
- **API Testing Harness**: `hurl` (v8.0+).

### B. Client POS Terminal & KDS (`apps/pos-client`)

- **Desktop/Tablet Shell**: Tauri v2.0+ (Stable).
- **Core Engine**: Rust (stable channel, Edition 2021).
- **Local Database**: SQLite 3.45+ accessed natively via Rust `rusqlite` (v0.31+) with bundled WAL mode (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`).
- **UI Presentation Layer**: React 18.3+, TypeScript 5.5+, Vite 5.4+.
- **UI Component Engine**: Ant Design 5.x (`antd` & `@ant-design/pro-components`).
- **Typography**: Instrument Sans (UI Prose) and IBM Plex Mono (Financials, Timers, Currency).

### C. Web Back-Office Admin (`apps/web-dashboard`)

- **Framework**: Next.js 14+ (App Router, React Server Components).
- **UI & Grids**: Ant Design 5.x + ProTable (`@ant-design/pro-components`).

### D. Public Marketing Website (`apps/marketing-site`)

- **Framework**: Next.js 14+ (App Router, SSG Mode).
- **Styling**: Tailwind CSS 3.4+ (Strictly isolated to marketing site; POS uses Ant Design token engine).

### E. Serverless Cloud Engine (`apps/edge-api`)

- **Compute**: Cloudflare Workers built using Rust via `worker-rs` (v0.2+).
- **State Sync Singleton**: Cloudflare Durable Objects (WebSocket singletons per store location).
- **Global Database**: Cloudflare D1 (Serverless SQLite).

---

## 7. Environment & Task Orchestration via mise

### Monorepo `.mise.toml` Configuration

```toml
[tools]
node = "24.19.0"
pnpm = "11.22.0"
rust = "stable"
hurl = "8"
"cargo:tauri-cli" = "2.0.0"

[env]
CARGO_TERM_COLOR = "always"
PLINTH_ENV = "development"

[tasks."init"]
description = "Initialize git hooks and install workspace dependencies"
run = "git config core.hooksPath .githooks && pnpm install"

[tasks."dev:pos"]
description = "Launch Tauri Native POS client in development mode"
run = "pnpm --filter pos-client exec tauri dev"

[tasks."dev:web"]
description = "Launch Next.js Cloud Admin Dashboard"
run = "pnpm --filter web-dashboard dev"

[tasks."dev:site"]
description = "Launch Next.js Marketing Site"
run = "pnpm --filter marketing-site dev"

[tasks."dev:api"]
description = "Launch Cloudflare Wrangler local edge simulator (Miniflare)"
run = "cd apps/edge-api && pnpm wrangler dev --port 8787"

[tasks."build:pos"]
description = "Compile native Rust binary and bundle production POS app"
run = "pnpm --filter pos-client exec tauri build"

[tasks."build:api"]
description = "Compile Rust WASM worker and deploy to Cloudflare Edge"
run = "cd apps/edge-api && pnpm wrangler deploy"

[tasks."db:migrate:local"]
description = "Run local SQLite migration scripts against Tauri Rust engine"
run = "cargo run --bin migrate_local"

[tasks."db:migrate:cloud"]
description = "Execute Cloudflare D1 remote SQL migrations"
run = "cd apps/edge-api && pnpm wrangler d1 migrations apply plinth_main_db"

[tasks."lint"]
description = "Enforce Cargo clippy and ESLint strictly across monorepo"
run = "cargo clippy --all-targets -- -D warnings && pnpm -r lint"

[tasks."test"]
description = "Execute Rust unit tests, TypeScript specs, and Hurl contract tests"
run = "cargo test --workspace && pnpm -r test"

[tasks."test:api"]
description = "Execute declarative API integration tests using Hurl"
run = "hurl --test tests/api/**/*.hurl"

[tasks."ui:capture"]
description = "Generate visual verification UI screenshots across POS and Dashboard viewports"
run = "pnpm tsx scripts/ui-capture.ts"
```

---

## 8. Declarative API Contract Verification (Hurl Test Specs)

### Example 1: Order Creation Endpoint Test (`tests/api/create_order.hurl`)

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

### Example 2: KDS Ticket Status Probe (`tests/api/get_kds_tickets.hurl`)

```hurl
GET http://localhost:8787/api/v1/kds/tickets
Header "X-Store-Id: store_loc_99"

HTTP 200
[Asserts]
jsonpath "$.data" count > 0
jsonpath "$.data[0].station_id" == "GRILL_01"
jsonpath "$.data[0].status" == "PENDING"
```

---

## 9. Complete Monorepo Workspace Structure

```text
plinth-monorepo/
├── .mise.toml                  # Mise environment and task configuration
├── Cargo.toml                  # Cargo Workspace root definition
├── package.json                # pnpm workspace root definition
├── pnpm-workspace.yaml         # pnpm workspace definition
│
├── tests/
│   └── api/                    # Hurl Integration & Contract Test Suite
│       ├── create_order.hurl
│       ├── get_kds_tickets.hurl
│       └── z_report_close.hurl
│
├── apps/
│   ├── pos-client/             # FOH Terminal & Kitchen KDS Application
│   │   ├── src-tauri/          # Tauri Native Engine (Rust)
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── src/
│   │   │       ├── main.rs     # Application Bootstrap
│   │   │       ├── commands/   # Tauri IPC Commands
│   │   │       ├── adapters/   # rusqlite & Network Socket Adapters
│   │   │       └── sync/       # Background Tokio Sync Loop
│   │   └── src/                # Pure React Presentation Layer
│   │       ├── App.tsx
│   │       ├── components/     # Ant Design Components
│   │       └── hooks/          # IPC Wrappers
│   │
│   ├── web-dashboard/          # Back-Office Admin Panel (Next.js 14)
│   │   ├── package.json
│   │   └── src/app/            # App Router: Menu, Reports, Inventory
│   │
│   ├── marketing-site/         # Public Marketing Website (Next.js 14 SSG)
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   └── src/app/            # Marketing Pages & Calculators
│   │
│   └── edge-api/               # Cloudflare Serverless Edge Engine
│       ├── Cargo.toml
│       ├── wrangler.toml       # Cloudflare Workers & Durable Objects Bindings
│       ├── src/
│       │   ├── lib.rs          # Rust worker-rs Entry Point
│       │   └── durable_objects/# Location Session Singleton DOs
│       └── migrations/         # D1 SQLite SQL Scripts
│
└── packages/
    ├── core-domain/            # Pure Rust Domain Logic, Aggregates, Traits & DDD Models
    │   ├── Cargo.toml
    │   └── src/
    │       ├── models/         # Order, Item, Ticket, Inventory Aggregate Roots
    │       ├── ports/          # Abstract Repositories & Engine Traits
    │       └── services/       # Core Domain Calculations
    │
    ├── sync-protocol/          # CRDT Queue Schemas & Serialization
    │   ├── Cargo.toml
    │   └── src/
    │
    └── ui-kit/                 # Ant Design Enterprise Linear Theme Tokens
        ├── package.json
        └── src/theme.ts
```

---

## 10. Verification & Execution Playbook

```bash
# 1. Initialize environment & toolchains
mise trust
mise install
pnpm install

# 2. Launch Local Cloud Edge Simulator (Terminal 1)
mise run dev:api

# 3. Launch Native POS Terminal (Terminal 2)
mise run dev:pos

# 4. Execute Contract & API Tests via Hurl (Terminal 3)
mise run test:api

# 5. Run Full Monorepo Test Suite
mise run test
```
