# 21_pos-quick-start.md - POS Terminal Quick Start Guide

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `22_order-taking-workflow.md` (next step in POS operations)
- `23-payment-processing.md` (payments after order taking)
- `24-split-bill-and-merging.md` (split and merge operations)
- `25-kds-kitchen-interaction.md` (KDS interaction)
- `DEVELOPER-NAVIGATION.md` (for developers supporting the system)
- `AGENTS.md` (project conventions)

---

## 21.1 Initial Login and Location Selection

### 21.1.1 Powering On

1. **Tap the power button** on the Tauri-based POS terminal
2. The system will boot to the **PlinthOS login screen**

### 21.1.2 Selecting Location

1. **On the location selection screen**, you'll see a list of restaurant sites associated with your login
2. **Tap the correct location** for this shift
   - If you manage multiple sites, use the search filter or scroll list
   - Only locations you have permission for will appear
3. **Tap "Confirm"** to load the POS interface for that location

### 21.1.3 Login Authentication

1. **After location selection**, you'll be prompted for authentication
2. **Enter your JWT token** or use the built-in authentication flow
3. **Select your role** (Cashier, Manager, Supervisor, etc.)
4. **Tap "Login"** to load the main POS interface

**Default test credentials** (for development/QA only):
- Location: `store_01` or `store_02`
- Role: `cashier` or `manager`
- Token: Any valid JWT with `x-tenant-id` and `x-location-id` headers

---

## 21.2 Main Interface Overview

Once logged in, the POS displays the **main order-taking interface**:

### 21.2.1 Screen Layout

| Area | Description |
|---|---|
| **Top Bar** | Location name, current time, network status, user role |
| **Menu Categories** | Scrollable tabs: Appetizers, Main Courses, Drinks, Desserts |
| **Item Grid** | Visual buttons for each menu item with name and price |
| **Order Preview** | Summary of items added, running total, payment tender |
| **KDS Status** | Real-time ticket status from kitchen display |
| **Function Buttons** | New Order, 86 Item, Split, Settlement, Void |

### 21.2.2 Navigation Tips

- **Scroll through categories** using swipe or side arrows
- **Tap an item** to add 1 quantity to the current order
- **Long-press an item** to open modifier selection (if modifiers configured)
- **Use the numeric keypad** to enter custom quantity (e.g., type "3" then "Enter" for 3 orders)
- **The running total updates live** as items are added

---

## 21.3 Taking Your First Order

### 21.3.1 Step-by-Step: Single Item Order

**Scenario**: A dine-in customer orders one "Butter Chicken" entree.

1. **Ensure correct location** is selected (see 21.1)
2. **Tap the "Appetizers/Mains" category** tab to browse main dishes
3. **Tap the "Butter Chicken" item button**
   - The item adds 1 quantity to the order preview
   - Price displays in the top of the order preview area
4. **If modifiers are configured** (e.g., "Mild", "Medium", "Spicy"):
   - A modifier selection screen appears
   - Tap your desired modifier(s)
   - The item price adjusts based on modifier price delta
5. **Review the order preview** - you should see:
   - "Butter Chicken" × 1
   - Current total (plus any modifier upcharge)
6. **If the customer orders nothing else**, proceed to payment (Section 21.4) or add more items

### 21.3.2 Step-by-Step: Multi-Item Order

**Scenario**: Family dine-in orders 2x Butter Chicken, 1x Garlic Naan, 2x Mango Lassi.

1. **Follow steps 1-4 above** for the first item (Butter Chicken)
2. **To add more items**:
   - Tap the next item (Garlic Naan) - adds to same order
   - Tap the third item (Mango Lassi) - adds to same order
   - The order preview accumulates all items with running total
3. **Adjust quantities** if needed:
   - Tap the item in the order preview
   - Increase/decrease quantity using + / - buttons
   - Or long-press to re-choose modifiers
4. **Continue adding items** until the order is complete
5. **Tap "Proceed to Payment"** when the order is complete

---

## 21.4 Payment Processing

### 21.4.1 Payment Types Supported

| Payment Type | Procedure |
|---|---|
| **Cash** | See 21.4.2 |
| **Card (Tap/Chip/Swipe)** | See 21.4.3 |
| **UPI** | See 21.4.4 |
| **Split Payment** | See 21.4.5 (multiple tenders) |
| **Tip/Gratuity** | See 21.4.6 |

### 21.4.2 Cash Payment

**Scenario**: Customer pays with cash for a $47.50 order.

1. **In the payment screen**, select **"Cash"** as the tender type
2. **The system shows** "Amount Due: $47.50"
3. **Customer tenders cash** to the cashier
4. **Cashier enters the amount received**
   - E.g., customer gives $50.00
   - System calculates change: $50.00 - $47.50 = $2.50
5. **Tap "Record Payment"**
6. **Print receipt** (automatic - ESC/POS thermal printer)
   - Receipt shows: items, total, cash received, change due
7. **Tap "Close Check"** or "New Order" to continue

**Change calculation** is done automatically using `rust_decimal::Decimal` (exact precision, no float imprecision).

### 21.4.3 Card Payment (Tap/Chip/Swipe)

**Scenario**: Customer pays with credit/debit card for $47.50.

1. **In the payment screen**, select **"Card"** as the tender type
2. **The system initiates** card terminal connection
   - If using external ESC/POS card reader: tap/insert/swipe the card
   - If using integrated terminal: follow on-screen prompts
3. **Card authorization** occurs (connects to edge API → payment processor)
4. **One of three outcomes**:
   - **Authorization Approved**: Tap "Capture Payment"
   - **Authorization Declined**: System shows decline reason; tap "Try Different Tender" or "Cash"
   - **Timeout/Error**: Tap "Retry" or "Switch Tender"
5. **If approved**, tap "Capture Payment" to finalize
6. **Print receipt** (automatic)
7. **Tap "Close Check"** to complete the order

**Receipt includes**: Authorization code, last 4 digits of card, tip adjustment option.

### 21.4.4 UPI Payment

**Scenario**: Customer pays via UPI (Unified Payments Interface, common in India and other regions).

1. **In the payment screen**, select **"UPI"** as the tender type
2. **The system generates** a UPI QR code or UPI ID payment link
3. **Customer scans** the QR code with their UPI app (PhonePe, Google Pay, Paytm, etc.)
   - Or taps the UPI ID link if displayed
4. **Customer confirms** the amount in their UPI app
5. **System receives** payment confirmation from UPI provider
6. **Tap "Record Payment"** to finalize the order
7. **Print receipt** (automatic)

**UPI receipt shows**: UPI transaction ID, timestamp, payer VPA (Virtual Payment Address).

### 21.4.5 Split Payment (Multiple Tenders)

**Scenario**: Customer wants to pay $47.50 using $20 cash + $27.50 card.

1. **In the payment screen**, select **"Split Payment"**
2. **The system splits** the UI into multiple tender sections
3. **First tender**: Select "Cash", enter $20.00
   - System records $20 cash received
   - Remaining balance: $47.50 - $20.00 = $27.50
4. **Second tender**: Select "Card", process card payment for $27.50
   - Follow card payment procedure (21.4.3)
   - System records $27.50 card payment
5. **Remaining balance** shows $0.00 when complete
6. **Tap "Finalize Split Payment"**
7. **Print combined receipt** showing both tenders
8. **Tap "Close Check"** to complete the order

**Split receipt** shows:
- Itemized list
- Tender 1: Cash $20.00
- Tender 2: Card $27.50
- Total: $47.50

### 21.4.6 Tip/Gratuity Addition

**Scenario**: Customer wants to add 15% tip on top of $47.50 order.

1. **After payment is recorded** (or during payment, depending on configuration)
2. **The tip screen** appears with suggested percentages:
   - 10%, 15% (default), 20%, 25%
3. **Or tap "Custom"** to enter a specific tip amount
4. **Enter the tip amount** or select a percentage
5. **The tip is added** to the order total
6. **Reprint receipt** if needed (shows tip line item)
7. **Tap "Close Check"** to complete

**Tip distribution** can be configured:
- Goes to the individual server/cashier
- Goes to house pool
- Optional (customers can skip tip)

---

## 21.5 Order Settlement and Z-Report

### 21.5.1 Settling an Order

After payment is recorded, the order must be **settled** to close the check.

1. **Verify all payments** are recorded (balance due = $0.00)
2. **Tap "Settle Order"** in the order preview/footer
3. **The system**:
   - Finalizes all financial calculations (using `rust_decimal::Decimal`)
   - Generates the settlement record
   - Updates KDS: tickets marked as "BUMPED" or "Served"
   - Emits `OrderSettled` domain event (syncs to KDS, Inventory, Billing contexts)
4. **Print final receipt** (if not already printed)
5. **Tap "New Order"** to start a new check, or "Close Shift" for end-of-day

### 21.5.2 Z-Report (End-of-Shift Reconciliation)

**At the end of a server's shift or cashier's shift**, generate a Z-Report to reconcile all checks, cash, and cards for the shift.

1. **From the main menu**, tap **"Shift Management"** → **"Close Shift"**
2. **The system shows**:
   - Total revenue for the shift
   - Cash tender summary
   - Card tender summary (by card type: Visa, MC, Amex, etc.)
   - UPI tender summary
   - Total tips collected
   - Opening float (starting cash in till)
3. **Verify the following**:
   - Opening float matches recorded start-of-shift count
   - Cash in till matches Z-Report cash total (plus/minus variance)
   - All orders for the shift are settled (no open checks)
4. **Tap "Generate Z-Report"**
5. **The system**:
   - Exports Z-Report JSON/CSV
   - Prints Z-Report on thermal printer
   - Resets till for next shift with new opening float
   - Emits `ShiftClosed` and `ZReportGenerated` domain events
6. **Store the Z-Report** for accounting/audit purposes

**Z-Report includes**:
- Shift start/end timestamps
- Opening float amount
- Closing cash count
- Card payment breakdown (totals by type)
- UPI payment totals
- Tip totals
- Net revenue (sales minus voids/refunds)
- Any cash variance (positive or negative, explained)

---

## 21.6 Common POS Operations

### 21.5.1 Voiding an Order

**Scenario**: Customer decides to cancel their order before payment.

1. **Before payment**: Tap "Void Order" in the order screen
2. **Select reason** from dropdown (e.g., "Customer Changed Mind", "Wrong Order", "Manager Request")
3. **If supervisor authorization** is required (configurable):
   - System prompts for supervisor JWT token or password
   - Supervisor enters credentials
4. **The order is marked** as voided
5. **Emits `OrderVoided` domain event**
6. **Reverts inventory** (if inventory deduction was already done - depends on configuration)
7. **Print void receipt** (optional)
8. **Tap "New Order"** to continue

### 21.5.2 Modifying an Existing Order

**Scenario**: Customer adds an item or changes quantity after order already in progress.

1. **Tap "Modify Order"** in the active order screen
2. **Options available**:
   - Add item(s) - follows 21.3 workflow
   - Change quantity - tap item in preview, adjust +/-
   - Remove item - tap item in preview, select "Remove"
   - Add modifier - tap item, long-press, select new modifier
3. **Changes are applied** instantly to the running order total
4. **KDS is notified** of item changes (if connected)
5. **Order preview updates** with new total

### 21.5.3 86'ing an Item (Marking Unavailable)

**Scenario**: A menu item is temporarily unavailable (e.g., out of stock, kitchen 86'd).

1. **From the main menu** or item selection screen, locate the item
2. **Tap the "86" or "Unavailable" badge** on the item
3. **The item button** grays out or shows "86'd - Unavailable"
4. **Customers cannot select** the 86'd item
5. **To restore**: Tap the "86" badge again, or a manager restores via dashboard
6. **Emits item availability event** (syncs to KDS and other locations if multi-site)

### 21.5.4 Transferring Items Between Tables

**Scenario**: Customer moves from Table 1 to Table 2 mid-order.

1. **In the active order**, tap "Transfer Table"
2. **Select the new table number** from the list
3. **The system**:
   - Keeps all items, modifiers, special requests
   - Updates the table assignment in the order
   - Notifies KDS of the table change
   - May re-print KOT (Kitchen Order Ticket) with new table number
4. **Emits `OrderTableChanged` domain event**
5. **Continue ordering** as normal

---

## 21.7 Troubleshooting Common POS Issues

| Issue | Likely Cause | Resolution |
|---|---|---|
| "Connection lost" banner | Network interruption | Wait for reconnection (system auto-reconnects); offline mode available for local orders |
| Item won't add to order | Item 86'd or no permissions | Check with manager; item may be temporarily unavailable |
| Payment declined | Card issuer, insufficient funds | Use different tender; for card: retry or switch to cash |
| Printer not printing | Thermal printer disconnected, out of paper | Check printer power, paper roll; tap "Reprint" on screen |
| "Incorrect total" | Item modifier price delta not calculated | Have manager verify modifier pricing; restart POS if persistent |
| "Login failed" | Invalid JWT token, wrong location | Re-authenticate; ensure correct location selected; contact admin for new token |
| KDS tickets not appearing | Durable Object WebSocket not connected | Check edge API status; restart POS client (Tauri dev restart) |
| "Split payment grayed out" | Configuration or permission issue | Manager must enable split payment feature; check role permissions |

---

## 21.8 Next Steps After Quick Start

After completing this quick start guide:

1. **Read** `22_order-taking-workflow.md` for detailed order workflows
2. **Read** `23-payment-processing.md` for in-depth payment scenarios
3. **Read** `25-kds-kitchen-interaction.md` for KDS ticket lifecycle
4. **Read** `29-shift-management.md` for shift open/close procedures
5. **Read** `33-troubleshooting-guide.md` for comprehensive issue resolution
6. **If you're a developer** supporting the POS: Read `DEVELOPER-NAVIGATION.md` and the developer documentation set

---
*This file is part of the PlinthOS end user documentation set. See related user files for complete operational guidance.*