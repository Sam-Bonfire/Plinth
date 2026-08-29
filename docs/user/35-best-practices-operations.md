# 35-best-practices-operations.md - Daily Operations Best Practices

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `29-shift-management.md` (shift procedures)
- `23-payment-processing.md` (payment workflows)
- `25-kds-kitchen-interaction.md` (KDS operations)
- `33-troubleshooting-guide.md` (issue resolution)

---

## 35.1 Opening Procedures (Per Restaurant Type)

| Restaurant Type | Opening Checklist |
|---|---|
| **QSR (Quick Service)** | 1. Tap "Open Shift"<br>2. Verify till float ($50-$200)<br>3. Check KDS is online<br>4. Review daily specials (86'd items)<br>5. Start first prep round (SLA timer starts at 8:00) |
| **Fine Dining** | 1. Tap "Open Shift"<br>2. Set table maps and place cards<br>3. Verify wine/beverage stock<br>4. Review course-stage configuration<br>5. Brief floor staff on reservations |
| **Food Hall** | 1. Tap "Open Shift"<br>2. Confirm shared KDS station assignment<br>3. Verify each tenant's menu is correct<br>4. Confirm cross-tenant reporting restrictions<br>5. Coordinate with neighboring stall operators |

---

## 35.2 Closing Procedures (Per Restaurant Type)

| Restaurant Type | Closing Checklist |
|---|---|
| **QSR** | 1. Settle all open orders<br>2. Count till cash<br>3. Tap "Close Shift" → generate Z-Report<br>4. Note any variances<br>5. Reset till for next day |
| **Fine Dining** | 1. Settle all open checks<br>2. Final wine inventory count<br>3. Tap "Close Shift" → generate Z-Report<br>4. Document any comp'd items/raisons<br>5. Archive nightly reservations |
| **Food Hall** | 1. Each stall settles its own orders<br>2. Shared KDS: ensure all tickets cleared<br>3. Tap "Close Shift" (per stall)<br>4. Consolidated Z-Report for whole food hall<br>5. Coordinate with other stall operators |

---

## 35.3 Rush Hour Preparation

| Situation | Preparation Steps |
|---|---|
| **Lunch rush (11:30-1:30)** | - Prep high-volume items in advance<br>- Staff 20% more cashiers/servers<br>- Set KDS to "Rush Mode" (elevated SLA thresholds temporarily)<br>- Ensure printer paper/thermal rolls extra |
| **Dinner rush (6:00-9:00)** | - Prep mise en place during afternoon<br>- Cross-train staff for multiple roles<br>- Enable KDS "Fast-Track" for urgent orders<br>- Review 86'd items; restore if needed |
| **Holiday/Events** | - Pre-shift manager briefing<br>- Adjust staff scheduling (overtime if needed)<br>- Update menu for event specials<br>• Test offline mode if network historically unstable |

---

## 35.4 End-of-Day Reconciliation

| Task | Description |
|---|---|
| **Cash count** | Physical count vs. Z-Report total; document variance |
| **Card batch settlement** | Ensure payment processor batch is settled; reconcile with Z-Report |
| **Tip distribution** | Verify tip pool or server payouts match tip total from Z-Report |
| **Inventory adjustment** | Record any wastage or count discrepancies from the shift |
| **Shift notes review** | Read handover notes from previous shift; ensure continuity |
| **Next-shift brief** | Communicate any carryover issues (86'd items, low stock, unresolved problems) |

---

## 35.5 Weekly Maintenance Tasks

| Task | Frequency | Description |
|---|---|---|
| **Physical inventory count** | Weekly | Count all stock items; adjust `current_qty` vs. system |
| **Menu review** | Weekly | Review item performance; remove low-performers; add seasonal items |
| **Modifier configuration review** | Monthly | Ensure modifier rules still make sense; update price deltas if cost changed |
| **D1 schema migration check** | Monthly | Verify `wrangler.toml` migration ordering is current; run `cargo tree -p core-domain` |
| **Clippy/lint cleanup** | Monthly | Run `cargo clippy --workspace --all-targets -- -D warnings`; fix any new warnings |
| **Backup verification** | Monthly | Verify D1 snapshots/exports are valid; test restore in staging |

---

## 35.6 Monthly Review Processes

| Process | Description |
|---|---|
| **Revenue trend analysis** | Compare this month vs. same month last year; identify growth/decline areas |
| **Staff performance** | Tip averages, order turnaround times, SLA compliance per server/chef |
| **Menu engineering** | Menu engineering matrix: stars (popular/profitable), plow (popular/low profit), puzzles (unpopular/profitable), dogs (unpopular/low profit) |
| **Equipment check** | Thermal printers, card terminals, KDS displays; clean/replace as needed |
| **Vendor review** | Review purchase order history; renegotiate contracts or switch suppliers |
| **SLA threshold review** | Are Green/Yellow/Red thresholds still appropriate? Adjust if business model changed |

---

## 35.7 Compliance and Audit

| Requirement | Frequency | Action |
|---|---|---|
| **Z-Report archival** | Every shift | Store Z-Reports (PDF/CSV) for 7 years (tax/audit requirement) |
| **Audit log review** | Monthly | Review `audit_events` for unusual activity (voids, permission changes, large refunds) |
| **Tax filing** | Quarterly/Annually | Use Z-Report tax liability data; file GST/VAT returns |
| **System updates** | As released | Apply `cargo update` / `pnpm upgrade` in staging; test; then production deploy |
| **Permission audit** | Quarterly | Review role-bitmasks; ensure least-privilege principle; remove obsolete permissions |

---

## 35.8 Next Steps

After reviewing best practices:

1. **Read** `29-shift-management.md` for shift open/close procedures
2. **Read** `23-payment-processing.md` for payment workflow optimization
3. **Read** `33-troubleshooting-guide.md` for common issue resolution

---
*This file is part of the PlinthOS end user documentation set.*