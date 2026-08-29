# 29-shift-management.md - Shift Opening and Closing

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `26_dashboard-user-guide.md` (dashboard context)
- `23-payment-processing.md` (payment flow within shift)
- `24-split-bill-and-merging.md` (split/merge affects shift totals)
- `30-z-reports-and-analytics.md` (Z-Report output)
- `33-troubleshooting-guide.md` (shift-related issues)

---

## 29.1 Opening a Shift

### 29.1.1 Shift Start Procedure

**From the dashboard** (`/shifts` → **"Open Shift"**):

1. **Select location** (if multi-location user)
2. **Enter starting cash float** (e.g., `$200.00`)
   - System stores as `cash_start` in minor units (`20000`)
3. **System verifies**:
   - Till is empty/open (no residual cash from prior shift)
   - No active open checks from previous shift (warns if found)
4. **Supervisor authorization** (if required by config):
   - Manager enters JWT or password
   - System records `opened_by` staff ID
5. **Shift opens**; banner displays:
   - "Shift Open Since 08:00 AM"
   - "Float: $200.00"
   - Time elapsed (live countup)
6. **Emits** `ShiftOpened` domain event → logs in `audit_events`

### 29.1.2 Opening Float Best Practices

| Practice | Reason |
|---|---|
| **Count cash twice** at start | Prevents later disputes |
| **Record large bills** ($50, $100) in shift notes | Audit trail |
| **Match float to prior shift** (if consistent) | Helps budgeting/forecasting |
| **If float mismatch** > $5.00 | Manager review before proceeding |

### 29.1.3 Starting Work

After shift opens:
- **New orders** flow to this shift's totals
- **KDS** receives new tickets normally
- **Inventory deductions** auto-occur on order settlement
- **Payment types** accepted: cash, card, UPI, split
- **Report generation** disabled until shift close

---

## 29.2 Closing a Shift

### 29.2.1 Shift Close Procedure

**From dashboard** (`/shifts` → **"Close Shift"** — available only when shift is open):

1. **System prompts**: "All orders must be settled before closing."
   - Checks for any open/unsettled orders; if found, lists them
2. **Settle all open checks** (or void/close as needed)
3. **Cash count verification**:
   - **Count physical cash** in till
   - **Enter cash count** in the system
   - **System computes**: `variance_cents = cash_end - cash_start - (card_total + upi_total + net_tips)`
4. **Review shift summary**:
   - **Revenue**: total sales (all tenders)
   - **Cash total**: physical count entered
   - **Card total**: batch settlement amount from payment processor
   - **UPI total**: sum of all UPI transactions
   - **Tip total**: gratuities collected
   - **Variance**: `cash_end - cash_start - (card_total + upi_total - net_tips)` — *positive = over, negative = under*
5. **Review exceptions**:
   - Any `variance_cents` ≠ 0 highlighted
   - Options: "Explain Variance", "Force Close Anyway"
6. **Generate Z-Report** (see 30.0)
7. **Shift closed**; banner changes to "Shift Closed — hh:mm"
8. **Emits** `ShiftClosed` and `ZReportGenerated` domain events
9. **Till resets** for next shift; `cash_start` field cleared

### 29.2.2 Variance Handling

| Variance Situation | Resolution |
|---|---|
| **Small variance** (±$0.01 − $1.00) | "Acceptable"; note in shift notes; close shift |
| **Moderate variance** (±$1.01 − $5.00) | Manager review required; investigate cause (counting error, unrecorded sale, refund) |
| **Large variance** (> $5.00) | **Do not close shift**; escalate to regional manager; investigate: possible theft, system error, unrecorded high-value sale |
| **Negative variance** (under) | Customer underpaid, or cashier under-counted |
| **Positive variance** (over) | Customer overpaid, or cashier over-counted, or unrecorded discount void |

### 29.2.3 Shift History

**After close**, shift appears in shift history:

| Column | Data |
|---|---|
| **Shift ID** | UUID (e.g., `sh_20260828_1`) |
| **Date** | Shift date |
| **Operator** | Staff ID + name who opened |
| **Revenue** | Total sales |
| **Cash Variance** | Over/under amount |
| **Tip Total** | Gratuities collected |
| **Status** | Closed/Voided |
| **Actions** | View Z-Report, Reopen Shift (if needed) |

**Reopening a closed shift** (rare, requires supervisor auth):
1. Navigate to closed shift in history
2. Click "Reopen Shift"
3. Supervisor enters credentials
4. Shift returns to "open" state; all prior data preserved
5. **Not recommended** except for data errors; preferred to correct via void/refund

---

## 29.3 Shift Handover (Between Staff)

### 29.3.1 Handover Procedure

**When shifting shifts** (e.g., server to server, cashier to cashier):

1. **Closing shift** taps **"Handover Shift"** (instead of close)
2. **System shows**: Revenue so far, open checks, cash count, tip total, any variances
3. **Incoming shift** taps **"Accept Handover"**
4. **Incoming shift** can:
   - **Accept** the handover data as-is
   - **Adjust float** (increase/reduce starting cash)
   - **Note discrepancies** (e.g., "Till was $10 short, counted again")
5. **Handover log** entry created in `audit_events`:
   - "Shift handover: from Staff A to Staff B"
   - "Revenue at handover: $X.XX"
   - "Cash variance noted: -$5.00"

---

## 29.4 Shift Notes and Comments

**During any shift**, staff can add notes:

1. **From shift screen**, tap **"Add Note"**
2. **Enter note** (max 200 chars):
   - "8-top party seated, waiting for drinks"
   - "Power outage 10 min, orders paused"
   - "Free dessert for birthday party #4"
   - "Deep fryer down, no fried items"
3. **Note appears** in shift history; visible to next shift via handover
4. **Emits** no domain event (internal communication only)

---

## 29.5 Next Steps

After mastering shift management:

1. **Read** `30-z-reports-and-analytics.md` for Z-Report details
2. **Read** `33-troubleshooting-guide.md` for shift-related issues
3. **Read** `23-payment-processing.md` for payment flow within shifts

---
*This file is part of the PlinthOS end user documentation set.*