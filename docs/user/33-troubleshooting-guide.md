# 33-troubleshooting-guide.md - Comprehensive Troubleshooting Guide

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (quick setup issues)
- `25-kds-kitchen-interaction.md` (KDS issues)
- `29-shift-management.md` (shift problems)
- `30-z-reports-and-analytics.md` (report generation errors)

---

## 33.1 Category: Connection and Network Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Connection lost" banner on POS | Network interruption, router reboot | Wait for auto-reconnection; POS operates in offline mode locally |
| KDS tickets not updating | Durable Object WebSocket disconnected | Check edge API status; restart KDS client; `wrangler dev --remote --restart` |
| Dashboard won't load | API proxy down, CORS misconfiguration | Verify `PLINTH_ENV`; check `curl https://api.plinth.local/health` |
| "Unable to reach server" | Firewall blocking port 8787 or 443 | Open ports; configure firewall for Cloudflare Worker domains |
| Hurl tests returning 401/500 | Edge API not running, wrong auth headers | Start `mise run dev:api`; add `Authorization: Bearer` and `X-Store-Id` headers |

---

## 33.2 Category: Payment Processing Errors

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Card declined" | Insufficient funds, issuer block | Use different card; contact bank |
| "Change calculation error" | (Should not happen with Decimal math) | Restart POS; if persistent, check database; log incident |
| "UPI transaction failed" | Provider API delay, invalid VPA | Check UPI Transaction ID; retry in 2-3 minutes; contact provider |
| "Split payment ghost tenders" | UI state not synced | Refresh POS; re-apply split; ensure finalize step completed |
| "Tip not appearing on receipt" | Tip config not saved, or tip skipped by customer | Verify tip settings in dashboard; confirm customer selected a percentage |

---

## 33.3 Category: KDS and Kitchen Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Stuck on PENDING" | Chef didn't tap "Start Prep"; network loss | Tap "Start Prep"; restore network if offline |
| "SLA never turns green" | Timer misconfigured, or constant new items adding to ticket | Verify SLA thresholds in dashboard (`/settings`); check if ticket should be split into multiple |
| "Can't bump ticket" | Ticket not in READY state, or insufficient permissions | Ensure ticket is READY; check staff permissions (`Permissions::BUMP_TICKET`) |
| "Wrong station assignment" | Ticket initially assigned incorrectly | Manager: long-press ticket → "Change Station"; reassign to correct station |
| "Allergen banner not showing" | Item not flagged as allergen in recipe | Update recipe in dashboard; re-sync KDS |
| "SLA alarm too loud" | Config too loud for environment | Manager: reduce volume in KDS settings (`/settings/kds`) |

---

## 33.4 Category: Inventory and Stock Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Current qty doesn't match physical count" | Count drift, waste not recorded, data entry error | Physical count → "Adjust Stock" (`/inventory`); investigate cause |
| "Low stock alert persists after reorder" | Reorder quantity too low; consumption rate higher than expected | Increase `reorder_point`; increase `maximum_stock`; review usage patterns |
| "Wastage not decrementing stock" | Wastage recorded but system not updating | Ensure "Record Wastage" form used (not manual `current_qty` edit); check for concurrent edits |
| "Stock goes negative" | In-flight orders + recipe deductions | Allow negative for active orders; reconcile on next physical count; check `last_counted_at` |

---

## 33.5 Category: Shift and Z-Report Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Z-Report generation failed" | Pending card batch, cash discrepancy > threshold | Settle all open checks; reconcile cash; resolve card batch errors; retry |
| "Shift won't close" | Open unvoided orders, unrefunded payments | Settle/void all orders; check for pending authorizations |
| "Variance keeps recurring" | Systemic counting error, unrecorded comps | Investigate pattern; implement side-work checklist; adjust float for next shift |
| "Revenue doesn't match bank deposit" | Timing difference (batch settlement vs. day close); tips in transit | Align Z-Report date with bank statement date; account for pending settlements |

---

## 33.6 Category: Dashboard and UI Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Page not loading" | Network interruption; API down | Refresh; check `https://api.plinth.local/health` |
| "Permission denied" on familiar page | Role changed, session expired | Re-login; if persistent, contact admin to verify role assignment |
| "Search returns no results" | Over-filtered; term not in database | Clear filters; check spelling; item may be 86'd or archived |
| "Global search (Ctrl+K) not working" | Focus not in input; shortcut disabled | Click search bar; ensure focus; check keyboard shortcuts override |

---

## 33.7 When to Contact Technical Support

**Contact support** if:

| Condition | Information to Provide |
|---|---|
| Issue persists after all above resolutions | Steps taken, timestamps, screenshots |
| Data loss or corruption | What was lost, when, business impact |
| Suspected security breach | Unauthorized access, strange API calls |
| Performance degradation slowdown | Times, affected operations, load level |
| Feature request or enhancement | Desired use case, benefit to operation |

**Support channels**: 
- Email: `support@plinthos.example.com`
- Slack: `#plinth-support`
- Support portal: `support.plinthos.com`

---

## 33.8 Next Steps

After troubleshooting:

1. **Read** `21_pos-quick-start.md` for POS-specific resolutions
2. **Read** `25-kds-kitchen-interaction.md` for KDS-focused fixes
3. **Read** `29-shift-management.md` for shift-related issues

---
*This file is part of the PlinthOS end user documentation set.*