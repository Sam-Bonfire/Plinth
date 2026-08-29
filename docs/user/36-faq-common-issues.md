# 36-faq-common-issues.md - Frequently Asked Questions

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `33-troubleshooting-guide.md` (detailed issue resolution)
- `25-kds-kitchen-interaction.md` (KDS-related FAQ)
- `29-shift-management.md` (shift-related questions)

---

## 36.1 General Setup Questions

**Q: How many restaurant locations can PlinthOS support?**
A: PlinthOS is designed to scale to dozens of restaurant locations under a single tenant. Each location has its own `location_id` and shares the `tenant_id`. The D1 database schema is built for multi-tenant isolation with mandatory `tenant_id` + `location_id` binding on every query.

**Q: Do I need special hardware for the POS terminal?**
A: The PlinthOS POS runs on any Tauri-capable device (Windows/macOS/Linux desktop, Android tablet, iPad). For production, you'll need an ESC/POS thermal printer (with TCP/IP connectivity) and a barcode scanner if desired. The system is designed to work with standard industry peripherals.

**Q: Can I run PlinthOS offline permanently?**
A: Yes. PlinthOS is offline-first by design. The POS terminal, KDS, and local database all function without a network connection. Features requiring network (card payments, UPI, cloud sync) are disabled offline but resume automatically when network restores.

**Q: Is there a limit on the number of menu items or orders?**
A: Practically, no. The D1 database supports up to 10GB storage, and the SQLite backend in the POS is limited only by available disk space. The CRDT sync system handles large volumes efficiently.

---

## 36.2 Technical Questions

**Q: What happens if the D1 database quota is exceeded?**
A: D1 has a 10GB storage threshold per database. If approached, archival strategy is: (1) export old data to Cloudflare R2 (object storage), (2) purge data older than 90 days while preserving audit trail, (3) optimize queries/indexes. Warning signs in monitoring: `plinth_d1_storage_bytes` near 8GB.

**Q: How are software updates deployed?**
A: Updates follow the deployment workflow (`mise run build:api` for edge API, `mise run build:pos` for POS). Changes are released as monorepo versions (0.1.0, 0.1.1, etc.). Critical security patches are deployed urgently; feature updates follow the regular release cycle (every 4-6 weeks).

**Q: Can I customize the receipt template?**
A: Yes. The ESC/POS printer receipt format is defined in the dashboard settings (`/settings/printer`). You can modify the JSON-based template to include your restaurant's logo, Terms of Service, or loyalty program info. Requires Admin role.

**Q: How are database backups handled?**
A: D1 automatic backups are enabled by Cloudflare (daily). For POS local SQLite, manual export is available via `/inventory` → "Export Database". Recommended: schedule weekly exports and store in a secure location (not on the same server).

---

## 36.3 Operation Questions

**Q: How do I handle a no-show reservation or cancelled order?**
A: For no-shows, mark the order as `Voided` (requires supervisor authorization). The system refunds any deposits and releases the table. For cancelled orders mid-preparation, the `TicketCancelled` event is emitted; ingredients are restocked automatically (inverse of `RecipeDeducted`).

**Q: Can I run PlinthOS on a single computer for all functions?**
A: Yes. The monorepo architecture allows all components to run on one machine for small operations:
- Edge API (Miniflare) on port 8787
- POS Tauri client
- Dashboard (Next.js)
- All share the same local D1 database

However, for production, separating the edge API (Cloudflare Workers) from the POS/client is recommended for redundancy and scale.

**Q: What if I forget my JWT token?**
A: Each session has a timeout (configurable, typically 8-12 hours). If expired, re-authenticate via the login screen. If you cannot log in, an Admin can generate a new JWT from the dashboard (`/staff` → "Manage Auth Tokens").

**Q: How do I handle tipping for different service types?**
A: Tipping is configurable per restaurant type:
- **QSR**: Tipping optional (0-10% typical)
- **Fast Casual**: Tipping optional (0-15% typical)
- **Fine Dining**: Tipping expected (15-20% default)
The tip percentage and distribution (server vs. house pool) are set in `/settings/tip-configuration`.

---

## 36.4 Troubleshooting Common Scenarios

| Scenario | Solution |
|---|---|
| **"Customer says they already paid"** | Check `audit_events` for `payment_recorded` entries; compare with Z-Report; if duplicate, void the duplicate and refund |
| **"Kitchen says order never came through"** | Check sync status: `mise run test:api` → Hurl tests; verify Durable Object WebSocket connection; look for `mutation_records` status=`conflict` |
| **"Wrong amount on Z-Report"** | Review shift close procedure; verify cash count was entered correctly; check for un-reconciled card batches from prior shifts |
| **"Staff can't see menu items"** | Verify the staff member's role permissions (`/staff` → edit permissions); check if item is 86'd or archived for the selected location |
| **"System clock is wrong"** | Affects SLA timers, audit timestamps. Update OS time; the system uses `Utc::now()` but relies on host clock. For production, configure NTP. |

---

## 36.5 Feature Requests and Roadmap

**Q: When is feature X coming?**
A: The roadmap is guided by customer feedback and restaurant operational needs. Check the `plinthos` changelog or contact your account manager for the latest feature timeline.

**Q: Can I contribute to PlinthOS?**
A: Yes! PlinthOS is open source (in the internal codebase). Contributions follow the `AGENTS.md` conventions: Conventional Commits, branch naming `<type>/<description>`, and the PR process outlined in `09_contributing-guide.md`. Documentation contributions are especially welcome—this very file series started that way!

**Q: Is there a mobile app for PlinthOS?**
A: The POS is a Tauri-based application that runs on desktop/tablet browsers. There's no separate native iOS/Android app, but the dashboard is responsive and works on mobile browsers for manager check-ins.

---

## 36.6 Glossary of Terms

| Term | Definition |
|---|---|
| **86'** (pronounced "eighty-six") | Restaurant slang for "unavailable"; an item marked 86'd cannot be ordered |
| **CRDT** | Conflict-Free Replicated Data Type; ensures sync convergence without central coordination |
| **D1** | Cloudflare's serverless SQLite database at the edge |
| **DO** | Durable Object; Cloudflare's stateful compute primitive for WebSocket singletons per location |
| **ED25519** | Ed-curve digital signature algorithm (48-byte signatures); used for mutation authenticity |
| **LWW** | Last-Writer-Wins; CRDT resolution strategy where latest timestamp wins |
| **OR-Set** | Observed-Remove Set; CRDT for sets where elements can be added/removed |
| **PN Counter** | Positive-Negative Counter; CRDT for integers with increment/decrement operations |
| **SLA** | Service Level Agreement; timer thresholds (Green <8m, Yellow 8-12m, Red >15m) |
| **Z-Report** | End-of-shift reconciliation summary (revenue, taxes, tender breakdowns) |

---
*This file is part of the PlinthOS end user documentation set.*