# 30-z-reports-and-analytics.md - Z-Reports and Sales Analytics

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `29-shift-management.md` (shift close precedes Z-Report)
- `23-payment-processing.md` (payment data sources for reports)
- `28-inventory-and-stock.md` (inventory valuation in reports)
- `31-staff-permissions-and-roles.md` (who can generate reports)

---

## 30.1 Z-Report Generation

### 30.1.1 Generating a Z-Report

**From dashboard** (`/shifts` → after closing a shift, or `/reports` → **"Generate Z-Report"**):

1. **Select shift** from date picker or "Last Shift" button
2. **System validates**:
   - Shift is closed (not open)
   - All payments reconciled (no pending card batches, no cash discrepancies beyond threshold)
3. **Generate Z-Report**; system produces:
   - **Z-Report ID**: UUID (e.g., `zr-20260828-1`)
   - **Export formats**: CSV, Excel (.xlsx), PDF (print-ready)
   - **Automatic email**: Option to email to owner/accountant (configured in settings)
4. **Z-Report stored** in database (`z_reports` table); accessible via `/reports/history`

### 30.1.2 Z-Report Components

| Section | Contents |
|---|---|
| **Shift Identification** | Shift ID, date, location, operator name |
| **Revenue Summary** | Total sales, net revenue (sales - refunds), service charge |
| **Payment Breakdown** | Cash total, card totals (by type: Visa/MC/Amex/Discover), UPI total |
| **Tip Summary** | Total tips, tip distribution (server/house/pool per config), average tip % |
| **Tax Liability** | Computed GST total for period; per `core-domain` `compute_gst()` |
| **Cash Summary** | `{"total": 500.00, "50s": 4, "20s": 12, "10s": 8, "5s": 6, "1s": 13, "0.25s": 20, "0.10s": 35, "0.05s": 28, "0.01s": 12}` |
| **Itemization** | List of all orders, their totals, payments, and tender types |
| **Variance** | Cash over/short amount (from shift close) |
| **Sign-off** | Operator signature (digitized); manager override if needed |

### 30.1.2.1 Sample Z-Report (PDF excerpt)

```
PlinthOS Restaurant - Z-Report
Check #001                                                  Page 1

Shift: sh_20260828_1                                        Date: 2026-08-28
Operator: Maria Garcia                                       Location: Downtown Bistro

====================================================================
SALES SUMMARY
====================================================================
Total Revenue:                  $4,230.00
Net Revenue (after refunds):    $4,180.00
Service Charge (5%):            $211.50

====================================================================
PAYMENT BREAKDOWN
====================================================================
Cash:                         $1,850.00
  - Bills: $850.00 (8 × $100, 1 × $50)
  - Coins: $100.00 (quarters, dimes, nickels, pennies)
Card - Visa:                  $1,120.00  (42 transactions)
Card - Mastercard:            $ 680.00  (28 transactions)
Card - American Express:       $ 95.00   ( 5 transactions)
Card - Discover:               $ 35.00   ( 2 transactions)
UPI:                           $ 210.00  (14 transactions)

====================================================================
TIPS
====================================================================
Total Tips:                     $320.00
  - Distribution: Server: $200.00, House Pool: $120.00
  - Average Tip %: 8.0% of sales

====================================================================
TAX LIABILITY
====================================================================
GST Total (5%):                 $211.50
  - Computed via core-domain compute_gst()

====================================================================
CASH VARIANCE
====================================================================
Starting Float:                 $200.00
Ending Cash Count:              $2,050.00
Variance:                       +$ 0.00  (balanced)

====================================================================
ORDERS SUMMARY
====================================================================
Total Orders:                   128
  - Dine-in:  95
  - Takeout:  23
  - Delivery:   10

====================================================================
====================================================================
                           Thank you. Keep for tax records.
====================================================================
```

---

## 30.2 Sales Analytics (Dashboard Reports)

### 30.2.1 Report Types accessible via `/reports`

| Report Type | Description | Key Metrics |
|---|---|---|
| **Sales Summary** | Daily/weekly/monthly revenue by channel | Revenue, order count, avg ticket |
| **Payment Breakdown** | Cash/ card/ UPI mix percentages | Payment method distribution |
| **Tip Analytics** | Total tips, distribution, trends | Tip %, per-server estimates, peak tipping times |
| **Product Performance** | Most ordered items, modifiers, course stages | Top 10 items, modifier popularity, 86 rates |
| **Category Analysis** | Revenue by menu category | Appetizers, mains, drinks, desserts |
| **Hourly Breakdown** | Sales by hour of day | Heatmap of busy periods |
| **Labor Cost %** | (If integrated with payroll) | Total labor cost vs sales |

### 30.2.2 Date Range Picker

- **Presets**: Today, Yesterday, This Week, This Month, Last 30 Days, Custom
- **Custom range**: Select start date and end date (max 2 years back)
- **Comparison**: Toggle "Compare to previous period" (show % change)

### 30.2.3 Export & Schedule

| Export Format | Use Case |
|---|---|
| **CSV** | Import into Excel, Google Sheets, QuickBooks |
| **Excel (.xlsx)** | Formatted reports with charts |
| **PDF** | Print-ready for accountants/auditors |
| **Google Sheets** | Live link; auto-updates weekly |

**Schedule**:
- **Automated**: Weekly email every Monday with prior week's Z-Report
- **Monthly**: On the 1st of each month, full month report
- **Disable**: Turn off in settings → Reporting → Scheduled Reports

---

## 30.3 Key Analytics Metrics

### 30.3.1 Core Metrics

| Metric | Formula | Normal Range |
|---|---|---|
| **Average Ticket** | Total Revenue / Total Orders | QSR: $15‑$25; Fine Dining: $40‑$100 |
| **Orders/Hour** | Total Orders / Operating Hours | QSR: 60‑120/hr; Fine Dining: 20‑40/hr |
| **Payment Mix** | % Cash, % Card, % UPI | Varies by region; cash-heavy < 30% card typical |
| **Tip Rate** | Total Tips / Total Revenue | 8‑18% typical; 20%+ for fine dining |
| **Tax Liability** | `compute_gst()` across all orders | Per jurisdiction rate; filed periodically |

### 30.3.2 Product Performance

| Metric | Description |
|---|---|
| **Top 10 Items** | Most ordered items (by quantity) |
| **Modifier Popularity** | E.g., "Medium Spicy" selected 42% of burger orders |
| **86 Rate** | % of time item was unavailable (86'd) during period |
| **Price Point Revenue** | Revenue distribution across price bands |
| **Course Stage Mix** | % of tickets at each KDS stage (APPETIZER/MAIN/DESSERT/DRINKS) |

### 30.3.4 Custom Reports (Admin)

**Admin-only feature**: Run arbitrary SQL against the D1 database:

```sql
-- Example: Revenue by item, by day, last 30 days
SELECT 
  DATE(created_at) as sales_day,
  menu_items.name,
  SUM(order_line_items.quantity) as units_sold,
  SUM(order_line_items.unit_price_cents) / 100 as revenue
FROM order_line_items
JOIN menu_items ON order_line_items.menu_item_id = menu_items.id
WHERE created_at >= date_sub(curdate(), interval 30 day)
GROUP BY sales_day, menu_items.name
ORDER BY sales_day, revenue DESC;
```

**Caution**: Read-only; does not modify data; still logged in `audit_events`.

---

## 30.4 Staff Permissions for Reports

| Role | Can Generate Z-Reports | Can Export Reports | Can Run Custom SQL |
|---|---|---|---|
| **Cashier** | No (own shifts only, if authorized) | No | No |
| **Manager** | Yes (own shifts + all shifts in location) | Yes (CSV/Excel) | No |
| **Supervisor** | Yes (all locations) | Yes (CSV/Excel) | No |
| **Admin** | Yes (all locations, all shifts) | Yes (all formats) | Yes |

**Permission**: `REPORTS_VIEW`, `REPORTS_EXPORT`, `REPORTS_SQL` (bitmask per `AGENTS.md`).

---

## 30.5 Next Steps

After reviewing Z-reports and analytics:

1. **Read** `29-shift-management.md` for shift close procedure that generates Z-Reports
2. **Read** `23-payment-processing.md` for payment data sources
3. **Read** `28-inventory-and-stock.md` for inventory valuation in reports

---
*This file is part of the PlinthOS end user documentation set.*