# DEVELOPER-NAVIGATION.md - PlinthOS Developer Documentation Master Index

**Version**: 0.1.0  
**Last Generated**: 2026-08-28  
**Purpose**: Master table of contents for the entire PlinthOS developer documentation set. Automatically generated from file headers; maintainer-updated for new files.

---

## 0.1  Quick Start for New Developers

| Action | Command | Related Files |
|---|---|---|
|  | `mise trust` | `01_env-setup.md` |
|  | `pnpm run init` | `01_env-setup.md` |
|  | Launch local dev environment | `02_local-development.md` |
  | Run full test suite | `mise run test` | `03_testing-workflow.md` |
  | Review architecture | Read overview | `04_hexagonal-architecture.md` |
  | Understand bounded contexts | Read context mapping | `05_bounded-contexts.md` |
  | Learn domain models | Read DDD patterns | `06_domain-modeling-patterns.md` |
  | Verify safety compliance | Run clippy | `07_rust-safety-mandates.md` |
  | Check TS standards | Run lint | `08_typescript-standards.md` |

---

## 0.2  Documentation Set Index

### Set 1: Internal Developer Documentation
| # | File | Topic | Length |
|---|---|---|---|
| 01 | `01_env-setup.md` | Environment initialization | ~8 KB |
| 02 | `02_local-development.md` | Local development workflow | ~11 KB |
| 03 | `03_testing-workflow.md` | Testing suites (Rust/TS/Hurl) | ~13 KB |
| 04 | `04_hexagonal-architecture.md` | Ports & Adapters pattern | ~32 KB |
| 05 | `05_bounded-contexts.md` | Four DDD bounded contexts | ~22 KB |
| 06 | `06_domain-modeling-patterns.md` | Aggregates, VO, Domain Events | ~29 KB |
| 07 | `07_rust-safety-mandates.md` | Safety mandates (unsafe, decimal) | ~24 KB |
| 08 | `08_typescript-standards.md` | TS strict mode, no `any` | ~18 KB |
| 09 | `09_contributing-guide.md` | Contributor workflow, PR process | ~10 KB |
| 10 | `10_commit-message-format.md` | Conventional Commits | ~15 KB |
| 11 | `11_branch-workflow.md` | Git branch management | ~12 KB |
| 12 | `12_api-contract-tests.md` | Hurl API contract testing | ~11 KB |
| 13 | `13_deployment-guide.md` | Production deployment workflow | ~9 KB |
| 14 | `14_sync-protocol.md` | CRDT offline-first synchronization | ~10 KB |
| 15 | `15_rust-testing-patterns.md` | Advanced Rust testing patterns | ~19 KB |
| 16 | `16_developer-navigation.md` | This file - master index | ~5 KB |

**Developer Set Total**: ~193 KB across 16 files

### Set 2: End User & Restaurant Manager Documentation
| # | File | Topic | Length |
|---|---|---|---|
| 21 | `21_pos-quick-start.md` | POS terminal quick start | ~15 KB |
| 22 | `22_order-taking-workflow.md` | Complete order taking workflow | ~12 KB |
| 23 | `23-payment-processing.md` | Payment types (cash/card/UPI/split/tips) | ~11 KB |
| 24 | `24-split-bill-and-merging.md` | Split bill and order merging | ~9 KB |
| 25 | `25-kds-kitchen-interaction.md` | KDS ticket lifecycle & SLA | ~12 KB |
| 26 | `26_dashboard-user-guide.md` | Back-office dashboard operations | *(in progress)* |
| 27 | `27_menu-management.md` | Menu management for managers | *(in progress)* |
| 28 | `28-inventory-and-stock.md` | Inventory tracking & reorder alerts | *(in progress)* |
| 29 | `29-shift-management.md` | Shift open/close & Z-reports | *(in progress)* |
| 30 | `30-z-reports-and-analytics.md` | Sales reports & analytics overview | *(in progress)* |
| 31 | `31-staff-permissions-and-roles.md` | Staff permissions & role-based access | *(in progress)* |
| 32 | `32-multi-location-management.md` | Managing multiple restaurant locations | *(in progress)* |
| 33 | `33-troubleshooting-guide.md` | Comprehensive troubleshooting FAQ | *(in progress)* |
| 34 | `34-offline-mode-behavior.md` | Offline-first operation guide | *(in progress)* |
| 35 | `35-best-practices-operations.md` | Daily operations best practices | *(in progress)* |
| 36 | `36-faq-common-issues.md` | Frequently asked questions | *(in progress)* |
| 37 | `37-setup-qsr.md` | QSR restaurant setup configuration | *(in progress)* |
| 38 | `38-setup-fine-dining.md` | Fine dining restaurant setup configuration | *(in progress)* |
| 39 | `39-setup-food-hall.md` | Food hall / multi-tenant setup configuration | *(in progress)* |

**User Set Total**: *[calculated upon completion]*

### Set 3: Cross-Cutting References (always available)

| File | Purpose |
|---|---|
| `DEVELOPER-NAVIGATION.md` | This master index |
| `AGENTS.md` | Project-wide source of truth (branch naming, commit format, safety mandates) |
| `README.md` | Existing extensive system architecture overview |

---

## 0.3  Filename Convention Guidelines

All documentation files follow this pattern:

```
/docs/<audience>/<nn>_<topic>.md
```

| Component | Format | Example |
|---|---|---|
| **audience** | `developer` or `user` | `docs/developer/` or `docs/user/` |
| **nn** | Two-digit number (01-39) | `01`, `21`, `33` |
| **topic** | Lowercase hyphen-separated description | `env-setup`, `pos-quick-start`, `rust-safety-mandates` |

**Rules**:
- All lowercase
- Words separated by hyphens (`-`), not underscores (`_`)
- Two-digit numbering with leading zero for 01-09
- No spaces in filenames
- Files are markdown (.md)

---

## 0.4  Cross-Reference Index

### By Topic

| Topic | Related Files |
|---|---|
| **Conventional Commits** | `10_commit-message-format.md`, `09_contributing-guide.md`, `11_branch-workflow.md` |
| **Hexagonal Architecture** | `04_hexagonal-architecture.md`, `05_bounded-contexts.md`, `06_domain-modeling-patterns.md` |
| **Rust Safety Mandates** | `07_rust-safety-mandates.md`, `15_rust-testing-patterns.md`, `AGENTS.md` |
| **TypeScript Standards** | `08_typescript-standards.md`, `AGENTS.md` |
| **Testing Workflow** | `03_testing-workflow.md`, `12_api-contract-tests.md`, `15_rust-testing-patterns.md` |
| **Deployment** | `13_deployment-guide.md`, `18_monitoring-and-observability.md`, `19_database-schema.md` |
| **CRDT Sync** | `14_sync-protocol.md`, `06_domain-modeling-patterns.md` |
| **Bounded Contexts** | `05_bounded-contexts.md`, `06_domain-modeling-patterns.md` |

### By File Relationships

| File | Depends On | Is Referenced By |
|---|---|---|
| `01_env-setup.md` | `AGENTS.md` | `02_local-development.md`, `03_testing-workflow.md` |
| `04_hexagonal-architecture.md` | `AGENTS.md`, `05_bounded-contexts.md` | `05_bounded-contexts.md`, `06_domain-modeling-patterns.md`, `12_api-contract-tests.md` |
| `09_contributing-guide.md` | `AGENTS.md`, `10_commit-message-format.md`, `11_branch-workflow.md` | `10_commit-message-format.md`, `11_branch-workflow.md` |
| `21_pos-quick-start.md` | `AGENTS.md` (mise commands) | `22_order-taking-workflow.md`, `23-payment-processing.md` |
| `25-kds-kitchen-interaction.md` | `05_bounded-contexts.md` | `24-split-bill-and-merging.md`, `29-shift-management.md` |

---

## 0.5  Version & Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-08-28 | Docs Team | Initial release - master navigation/index |
| 0.1.1 | YYYY-MM-DD | TBD | Updates based on new file additions |
| 0.2.0 | YYYY-MM-DD | TBD | Major overhaul for new documentation sets |

---
*This file is the master navigation and index for the PlinthOS documentation. It is reviewed and updated whenever new files are added to either the developer or user documentation sets. See `AGENTS.md` for the source of truth governing all project conventions, and the individual file headers for authorship and version information.*

---
*End of DEVELOPER-NAVIGATION.md*