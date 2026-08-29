# 24-split-bill-and-merging.md - Split Bill and Order Merging

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `22_order-taking-workflow.md` (order creation context)
- `23-payment-processing.md` (payment after split/merge)
- `25-kds-kitchen-interaction.md` (KDS impact)
- `29-shift-management.md` (shift implications)

---

## 24.1 Split Bill Operations

### 24.1.1 When to Split a Bill

| Scenario | Example |
|---|---|
| **Friends sharing meal** | 4 people, one large order; each pays for their items |
| **Different payment methods** | Person A: cash, Person B: card, Person C: UPI |
| **Partial payment** | Customer pays deposit, remainder later |
| **Corrected order** | Wrong item removed, need separate check for remaining |

### 24.1.2 Split by Seat (Automatic)

**When seat numbers are assigned** to order items (per 22.3 Seat Assignment):

1. **In active order**, tap **"Split by Seat"**
2. **System automatically** creates separate checks based on seat assignments
3. **Each check shows**:
   - Items assigned to that seat
   - Seat's subtotal
   - Individual payment prompt
4. **Server processes** each check independently
5. **All checks combined** show original order total (reconciliation)

**Example**: Table of 4, each person ordered differently:
- Seat 1: 1x Butter Chicken ($14.00)
- Seat 2: 1x Garlic Naan ($4.50) + 1x Mango Lassi ($5.00)
- Seat 3: 2x Samosa ($6.00 each = $12.00)
- Seat 4: 1x Chicken Curry ($16.00)

System creates 4 separate checks, each with correct items and total.

### 24.1.3 Split by Item (Manual)

**When seat assignments aren't used**, or to customize the split:

1. **In active order**, tap **"Split by Item"**
2. **Items list** shows all line items in the order
3. **Tap items** to assign to different checks:
   - Tap item → moves to new check #1
   - Un-tapped → stays on current check #2
4. **After assignment**, review each check's subtotal
5. **Tap "Finalize Split"**
6. **System creates** N separate checks (N = number of checks selected)
7. **Process payment** on each check independently

**Example**: 3-item order, customer wants 2 items on one check, 1 item on another:
- Check 1: Item A + Item B = $18.50
- Check 2: Item C = $12.00

### 24.1.3 Refund on Split

If a split check needs adjustment:

1. **Void specific tender** on that check (not the entire order)
2. **Refund amount** goes to original tender method
3. **Recalculate remaining tenders** proportionally if needed
4. **Reprint receipt** for adjusted check

---

## 24.2 Order Merging Operations

### 24.2.1 When to Merge Orders

| Scenario | Example |
|---|---|
| **Same table, separate checks** | Server accidentally created two checks for Table 5; now wants one |
| **Customer wants combined** | Two small orders merged into one bill |
| **Parental control** | Children's orders merged with parents' |
| **Pre-payment consolidation** | Two separate checks paid together (cash + card) |

### 24.2.2 Merge Orders Procedure

**Scenario**: Table 7 has two separate checks (Check A and Check B), customer wants one combined check.

1. **From main menu**, tap **"Merge Orders"**
2. **System shows** list of open checks for this table/location
3. **Select Check A** (first check to merge)
4. **Select Check B** (second check to merge)
5. **System validates**:
   - Same table/location
   - No settled items (both checks must be unsettled)
   - No conflicting payments in progress
6. **If valid**, merges checks:
   - All items from both checks combine into one
   - Running total = Check A total + Check B total
   - Seat assignments merge (if applicable)
   - Domain event `BillSplit` emitted (in reverse: check merge)
7. **Single check** displays for payment processing
8. **Process payment** on combined total

### 24.2.3 Transfer Items Between Checks

**Scenario**: Customer decides one item should be on different check after merge attempt.

1. **In merged/check view**, tap **"Transfer Item"**
2. **Select item** to move from one check to another
3. **Select destination check**
4. **System moves** item and recalculates subtotals
5. **Tap "Confirm"** to finalize transfer

---

## 24.3 Post-Split/Merge KDS Impact

### 24.3.1 KDS Ticket Creation After Split

**After split by seat or item**:

1. **System creates N KDS tickets** (N = number of checks)
2. **Each ticket** contains its assigned items
3. **Ticket status** starts as `PENDING`
4. **KDS displays** all tickets; kitchen staff sees item distribution
5. **Course stages** tracked per ticket (if applicable)

**Example**: Split 4-way creates 4 KDS tickets, each with their items. Chef marks each ticket independently.

### 24.3.2 KDS Ticket Status Updates

| Action | KDS Effect |
|---|---|
| **Fire item** on specific check | That ticket's item marked fired |
| **Bump ticket** | Server marks item served on that check |
| **Settle check** | That check's payment recorded; ticket status → BUMPED/Settled |
| **Merge tickets** | Items consolidated into fewer tickets (if still in prep) |

### 24.3.2 KDS Workflow with Splits

```mermaid
stateDiagram-v2
    [*] --> Split: Order split N ways
    
    state SplitTickets {
        [*] --> Ticket-1: Check 1 created
        [*] --> Ticket-2: Check 2 created
        [*] --> Ticket-3: Check 3 created
        [*] --> Ticket-4: Check 4 created
        
        Ticket-1 --> Bumped: Server serves Check 1
        Ticket-2 --> Bumped: Server serves Check 2
        Ticket-3 --> Bumped: Server serves Check 3
        Ticket-4 --> Bumped: Server serves Check 4
    }
```

---

## 24.4 Shift Implications

### 24.4.1 Split/Merge in Z-Report

**At shift close** (`29-shift-management.md`):

| Situation | Z-Report Treatment |
|---|---|
| **Splits during shift** | Each split check appears as separate revenue line |
| **Merged orders** | Combined total appears as single line; item-level detail in audit trail |
| **Net effect** | Total revenue unchanged; only check-level granularity changes |

### 24.4.2 Audit Trail

All splits and merges emit domain events and are logged:

- `BillSplit`: Created when order split
- `BillMerge`: Created when orders merged
- Both include: timestamp, operator (staff ID), reason (optional), affected items/totals
- Logged in audit_events table (per `README.md` Section 9)
- accessible via API: `GET /api/v1/audit/logs`

---

## 24.5 Common Split/Merge Scenarios & Solutions

| Scenario | Solution |
|---|---|
| "Split by seat created wrong checks" | Re-seat items; use "Split by Item" instead; verify seat assignments |
| "Cannot merge - says 'checks already settled'" | Ensure both checks are unsettled (no payments recorded) |
| "Wrong item on wrong check after split" | Re-split; use "Split by Item" for precise control |
| "KDS shows wrong items after split" | Kitchen staff: verify ticket assignments; re-fire items to correct tickets |
| "Payment applied to wrong check" | Void that tender; re-apply to correct check (void/reprocess) |
| "Z-Report total doesn't match" | Review split/merge audit logs; totals should be unchanged at shift level |

---

## 24.6 Quick Reference: Split/Merge Commands

| Action | POS UI Path | Shortcut |
|---|---|---|
| **Split by Seat** | Main order screen → "Split by Seat" | F2 key (if configured) |
| **Split by Item** | Main order screen → "Split by Item" | F3 key (if configured) |
| **Merge Orders** | Main menu → "Merge Orders" | F4 key (if configured) |
| **Transfer Item** | Check view → "Transfer Item" | F5 key (if configured) |

---

## 24.7 Troubleshooting Split/Merge

| Issue | Cause | Resolution |
|---|---|---|
| "Split unavailable" | No seat assignments, or order already submitted | Assign seats, or reopen order (manager auth), then split |
| "Merge denied - different tables" | Checks must be same table/location | Ensure both checks are for same table/site |
| "KDS out of sync after split" | Kitchen not notified of split | Manually notify via KDS dashboard; or restart KDS connection |
| "Payment on wrong check" | Human error during split | Void incorrect tender; re-apply to correct check |
| "Z-Report mismatch" | Unreconciled splits/merges from prior shifts | Review audit logs; ensure all shifts balanced |

---

## 24.8 Next Steps

After mastering split/merge:

1. **Read** `25-kds-kitchen-interaction.md` for KDS workflow integration
2. **Read** `29-shift-management.md` for shift close and Z-Report with splits/merges
3. **Read** `33-troubleshooting-guide.md` for issue resolution

---
*This file is part of the PlinthOS end user documentation set.*