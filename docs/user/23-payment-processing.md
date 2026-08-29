# 23-payment-processing.md - Payment Processing Comprehensive Guide

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (quick setup)
- `22_order-taking-workflow.md` (order creation)
- `24-split-bill-and-merging.md` (split/merge operations)
- `25-kds-kitchen-interaction.md` (KDS after payment)
- `33-troubleshooting-guide.md` (issue resolution)

---

## 23.1 Payment Types Supported

PlinthOS POS supports four primary payment methods, with sub-options within each.

| Primary Method | Sub-options | Typical Use |
|---|---|---|
| **Cash** | Physical banknotes/coins | Small restaurants, daily markets |
| **Card** | Tap, Chip, Swipe, QR | Most retail/restaurant settings |
| **UPI** | QR code, Virtual Payment Address | India, Southeast Asia, expanding globally |
| **Split** | Any combination of above | When customer wants to divide payment |

---

## 23.2 Cash Payment

### 23.2.1 Procedure

1. **After order settlement**, tap **"Cash"** as tender type
2. **System shows** "Amount Due: $X.XX"
3. **Customer hands cash** to cashier
4. **Cashier enters received amount** via numeric keypad
   - E.g., order is $47.50, customer gives $50.00
   - System calculates: Change = $50.00 - $47.50 = $2.50
5. **Tap "Record Payment"**
6. **Receipt prints automatically** (ESC/POS thermal printer)
7. **Tap "Close Check"** or "New Order"

### 23.2.2 Cash Handling Best Practices

| Practice | Reason |
|---|---|
| **Count back change** to customer | Verifies accuracy; customer hears confirmation |
| **Log large bills** ($50, $100) in shift notes | Audit trail for end-of-shift reconciliation |
| **Verify denomination** before entering amount | Prevents entry errors ($20 entered for $10 bill) |
| **Cash drawer count** at shift start/end | Per `29-shift-management.md` Z-Report requirements |

### 23.2.3 Common Cash Errors

| Error | Cause | Resolution |
|---|---|---|
| "Change calculation error" | Float/rounding issue (should not happen - Decimal math) | Restart POS; if persistent, check database entry |
| "Over/short by $0.01" | Human counting error | Count back to customer; log variance in shift notes |
| "Drawer open during transaction" | Security concern | Close drawer; void transaction if unauthorized; log incident |

---

## 23.3 Card Payment (Tap/Chip/Swipe)

### 23.3.1 Card Machine Connection

1. **In payment screen**, select **"Card"** tender type
2. **System connects** to card terminal (via Bluetooth/TCP/Ethernet)
3. **Terminal prompts**: "Tap", "Insert Chip", or "Swipe"
4. **Customer performs** card transaction
5. **Terminal returns** authorization result (Approved/Declined/Error)

### 23.3.2 Authorization Outcomes

| Outcome | Action |
|---|---|
| **Approved** | Tap "Capture Payment" to finalize |
| **Declined** | System shows reason (e.g., "Insufficient Funds", "Call Issuer")<br>Options: "Try Different Tender", "Retry", "Void Payment" |
| **Timed Out** | "Retry" or "Switch Tender"<br>May require re-inserting card |
| **Error/Technical** | "Contact Payment Processor"; log error; accept alternative tender |

### 23.3.3 Card Types Supported

| Card Type | Symbol/Logo | Notes |
|---|---|---|
| **Visa** | ✈️ | Universal acceptance |
| **Mastercard** | MC | Universal acceptance |
| **American Express** | Amex | May have different processing fees |
| **Discover** | Discover | Less common but supported |
| **Debit (Interac)** | ✓ | PIN entry required |
| **EBT/SNAP** | 🍎 | Government benefits; separate terminal/config |

### 23.3.4 Receipt Details (Card Payment)

Card receipt automatically includes:
- Last 4 digits of card (PCI compliance - full PAN never stored)
- Authorization code (from processor)
- Transaction ID (processor reference)
- Card type icon
- Date/time stamp
- **Tip adjustment option** (post-authorization tip addition)

---

## 23.4 UPI Payment

### 23.4.1 UPI Procedure (India/SE Asia regions)

1. **In payment screen**, select **"UPI"** tender type
2. **System generates UPI QR code** or payment link
3. **Customer opens** UPI app (PhonePe, Google Pay, Paytm, BHIM, etc.)
4. **Customer scans QR** or taps payment link
5. **Amount pre-filled** from POS system
6. **Customer confirms amount** in UPI app
7. **UPI app shows** "Authorizing..." then "Success"
8. **System receives** confirmation from UPI provider
9. **Tap "Record Payment"** to finalize order
10. **Receipt prints** with UPI Transaction ID

### 23.4.2 UPI Provider Integration

PlinthOS integrates with common UPI providers via the edge API:

| Provider | Integration Method | Notes |
|---|---|---|
| **PhonePe** | OAuth 2.0 + QR | Most popular in India |
| **Google Pay** | Native SDK | Works across Android |
| **Paytm** | Merchant SDK | Indian market strong |
| **BHIM** | Government app | No merchant fees |
| **Amazon Pay** | Similar to GP | Growing adoption |

**Edge API handles**: Provider API keys, token rotation, transaction reconciliation, failure retries.

### 23.4.3 UPI Receipt Fields

UPI receipt includes:
- UPI Transaction ID (unique per payment)
- Payer VPA (Virtual Payment Address)
- Amount (same as order total)
- Timestamp (UTC)
- Merchant Name (from POS profile)
- Remarks (optional: "Order #1234 - Butter Chicken")

---

## 23.5 Split Payment (Multiple Tenders)

### 23.5.1 When to Use Split Payment

| Scenario | Example |
|---|---|
| **Customer doesn't have cash for full amount** | $50 order, customer has $20 cash + card for rest |
| **Multiple people paying** | 3 friends splitting $45 pizza order |
| **Partial card, partial cash** | Card for main items, cash for tip/delivery fee |
| **Loyalty points + cash** | Points cover part, pay remainder |

### 23.5.2 Split Payment Procedure

**Scenario**: $47.50 order, split as $20 cash + $27.50 card.

1. **In payment screen**, select **"Split Payment"**
2. **UI divides** into tender sections:
   - **Section A**: Cash $0.00 (editable)
   - **Section B**: Card $0.00 (editable)
3. **Section A - Cash**:
   - Enter $20.00
   - System records $20 received
   - Remaining balance: $27.50
4. **Section B - Card**:
   - Process card payment for $27.50 (follow 23.3 procedure)
   - System records $27.50 card payment
   - Remaining balance: $0.00
5. **Tap "Finalize Split Payment"**
6. **Print combined receipt** showing both tenders
7. **Tap "Close Check"** to complete order

### 23.5.3 Split Receipt Format

```
PlinthOS Restaurant - Check #123
Date: 2026-08-28 19:30

Items:
  2x Butter Chicken    $28.00
  1x Garlic Naan        $ 4.50

Subtotal:   $32.50
Discount:    -$ 2.00  (Loyalty15)
Tax:          $ 2.00
-------------------
Total:        $47.50

Tender 1: Cash       $20.00
Tender 2: Card       $27.50
-------------------
Change:           $ 0.00

--- Thank you! ---
```

### 23.5.4 Split Payment Rules

| Rule | Description |
|---|---|
| **Maximum tenders** | Configurable (default: 3 split tenders per order) |
| **Cash back** | Not allowed on split; full change given on final tender |
| **Tip on split** | Tip added to final tender amount, or separate tip line |
| **Refund on split** | Refund goes to original tender; partial refunds possible |
| **Void on split** | Void percentage of each tender proportional to amount |

---

## 23.6 Tip/Gratuity Addition

### 23.6.1 Tip Scenarios

| Scenario | Procedure |
|---|---|
| **Tip after card payment** | After card authorization, tip screen appears; select % or custom amount |
| **Tip during split payment** | Tip added to final tender, or split proportionally |
| **Tip on cash order** | Customer adds cash tip on top of amount received; enter as received amount > total |
| **No tip** | Select "0%" or "Skip tip"; system proceeds without gratuity |

### 23.6.2 Tip Percentages (Pre-configured)

| Percentage | Typical Use |
|---|---|
| **10%** | Standard tip for average service |
| **15%** | Expected tip for good service (default in many configs) |
| **18%** | Good service, larger party |
| **20%** | Excellent service, white-tablecloth |
| **25%** | Outstanding service, special occasion |

### 23.6.3 Tip Distribution (Backend Configuration)

Tip money is tracked and can be configured to:

| Distribution | Description |
|---|---|
| **To Server** | Tip goes to the specific server/cashier who waited the table |
| **House Pool** | Tip goes to restaurant; distributed among all staff (bussers, cooks, bar) |
| **Split** | Partial to server, partial to house (configurable percentages) |
| **Optional** | Customers can skip tip entirely |

**Configuration**: Set in dashboard → Settings → Tip Configuration.

### 23.6.4 Tip on Receipt

Receipt shows:
- Subtotal
- Tax
- **Tip amount** (line item)
- **Total with tip**
- Tip distribution (if configured: "Server" or "House")

---

## 23.7 Payment Reconciliation and Discrepancies

### 23.7.1 Payment Reconciliation (End of Day)

Per `29-shift-management.md`, at shift close:

1. **Z-Report generates** all payment types for the shift
2. **Cash count** verified against Z-Report total
3. **Card settlement** matches processor statements (batch settlement)
4. **UPI reconciliation** matches provider transaction logs
5. **Tip totals** summed and distributed per configuration
6. **Variance reported** if any discrepancy (cash over/short, card batch mismatch)

### 23.7.2 Common Payment Discrepancies

| Discrepancy | Likely Cause | Resolution |
|---|---|---|
| "Cash short by $5.00" | Customer underpaid, or cashier entry error | Review transaction logs; count drawer with manager |
| "Card batch mismatch $20.00" | Processor batch settlement timing | Wait for next batch cycle; reconcile daily |
| "UPI transaction not found" | Provider API delay, wrong UPI ID | Check UPI Transaction ID; contact provider support |
| "Tip not distributed" | Configuration issue, or tip in pending state | Check tip config in dashboard; wait for next reconciliation cycle |

### 23.7.3 Voiding a Payment

| Payment Type | Void Procedure |
|---|---|
| **Cash** | Void order entirely; cash returned to customer; log in shift notes |
| **Card** | Payment processor void (reverses authorization); may take 3-5 business days to reflect |
| **UPI** | UPI reverse transaction (depends on provider; typically 24-48 hours) |
| **Split** | Void proportional amounts from each tender; system handles proportionally |

---

## 23.8 Next Steps

After mastering payment processing:

1. **Read** `24-split-bill-and-merging.md` for split/merge bill workflows
2. **Read** `25-kds-kitchen-interaction.md` for what happens after payment (KDS status updates)
3. **Read** `29-shift-management.md` for shift open/close and Z-Report procedures
4. **Read** `33-troubleshooting-guide.md` for payment-specific issue resolution

---
*This file is part of the PlinthOS end user documentation set. See related user files for complete operational guidance.*