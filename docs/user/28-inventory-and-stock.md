# 28-inventory-and-stock.md - Inventory and Stock Tracking

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `26_dashboard-user-guide.md` (dashboard context)
- `27_menu-management.md` (menu-to-stock mapping)
- `29-shift-management.md` (shift close and inventory reconciliation)
- `30-z-reports-and-analytics.md` (inventory valuation in reports)

---

## 28.1 Real-Time Stock Level Monitoring

### 28.1.1 Stock Dashboard Grid

From the dashboard navigation (`/inventory`), the user sees a **grid of all stock items** for this location:

| Column | Description |
|---|---|
| **Item Name** | e.g., "Beef Patty", "White Rice", "Soda Syrup" |
| **Unit of Measure** | e.g., "each", "kg", "liter", "portion" |
| **Current Qty** | Real-time stock on hand (in base units) |
| **Reorder Point** | Threshold that triggers alert (configurable) |
| **Max Stock** | Optimal ceiling (configurable) |
| **Variance** | `current_qty - reorder_point` (green/yellow/red) |
| **Last Counted** | Date of physical inventory count |

### 28.1.2 Interpreting Stock Levels

| Variance Color | Meaning | Action |
|---|---|---|
| **Green** | `current_qty >= reorder_point` | Normal operation; no action |
| **Yellow** | `current_qty` within 10% of `reorder_point` | Monitor; plan reorder soon |
| **Red** | `current_qty < reorder_point` | **Low stock alert** → place order immediately |

### 28.1.3 Stock Adjustment

**Manual stock adjustment** (for counted differences, wastage, or setup):

1. **Locate the item** in the inventory grid
2. **Click "Adjust Stock"** (or three-dot menu → "Adjust")
3. **Enter adjustment reason**:
   - Physical count reconciliation
   - Wastage/spoilage recording
   - Setup/initial stock for new location
   - Correction of system error
4. **Enter adjustment quantity** (positive = add stock, negative = remove/deduct)
5. **System updates** `current_qty` immediately
6. **Emits** `StockAdjusted` domain event → syncs to KDS, POS, other locations (if multi-site)
7. **Audit log**: `audit_events` entry created (who, when, reason, old/new qty)

### 28.1.4 Unit Conversion

**Per `19_database-schema.md`**, each stock item has:
- `unit_qty`: "each", "kg", "liter", "portion"
- `conversion_factor`: how many base units in this unit (e.g., 1 kg = 1000 g → factor 1000)

**Example**: Stock item "Cooking Oil"
- `unit_qty`: "liter"
- `conversion_factor`: 1000 (1 liter = 1000 ml; base unit is ml)
- `current_qty`: `500` → means 500 liters in stock
- If checking in ml: `500 × 1000 = 500,000 ml`

**POS ordering** always sends quantities in the menu item's recipe mapping, not raw stock units.

---

## 28.2 Reorder Alerts and Purchase Orders

### 28.2.1 Low Stock Alert Triggers

When `current_qty` drops to or below `reorder_point`:

1. **Alert banner** appears at top of inventory screen
2. **Item row** turns red in the grid
3. **"Place Order"** button becomes active
4. **Emits** `StockReorderAlert` domain event → syncs to all locations (if multi-site)

### 28.2.2 Creating a Purchase Order

1. **Click "Place Order"** on the low-stock item
2. **Purchase order form**:
   - **Vendor**: Select from configured vendor list (or "New Vendor")
   - **Quantity**: How much to order (recommended based on `maximum_stock - current_qty`)
   - **Expected Delivery**: Date picker
   - **Unit Price**: Cost per unit (for budgeting)
   - **Notes**: Delivery instructions, preferred contact
3. **Submit** purchase order
4. **System creates** purchase order record (not yet affecting `current_qty`)
5. **Upon delivery**: Receive goods → "Receive Stock" (see below)

### 28.2.3 Receiving Stock

1. **When delivery arrives**, navigate to the item in inventory
2. **Click "Receive Stock"**
3. **Enter received quantity** (must match purchase order or explain discrepancy)
4. **System updates** `current_qty` immediately
5. **Emits** `StockAdjusted` event (positive delta)
6. **Compare to purchase order**; reconcile discrepancy if any
7. **If discrepancy**: Add note; adjust inventory manually if needed (see 28.1.3)

---

## 28.3 Wastage Tracking

### 28.3.1 Recording Wastage

**For spoilage, trim, errors, or expired items**:

1. **From inventory grid**, locate item
2. **Click "Record Wastage"**
3. **Wastage form**:
   - **Quantity**: Amount wasted (in base units; system converts to match `unit_qty`)
   - **Reason**: "Spoilage", "Trim", "Error", "Expired", "Customer Return"
   - **Description**: Free text (e.g., "Left out too long, discarded")
   - **Date**: Auto-fills today; editable
4. **System updates**:
   - `current_qty` decreased by wasted amount
   - `total_wastage_lifetime` incremented (aggregate across item lifetime)
5. **Emits** `WastageRecorded` domain event
6. **Audit log**: `audit_events` entry

**Wastage vs Normal Deduction**: 
- **Normal**: Recipe deduction when ORDER_SUBMITTED event received (automatic, tracked separately)
- **Wastage**: Manual entry for non-recipe loss; does **not** count against `reorder_point` (separate threshold)

### 28.3.2 Wastage Report

**In** `30-z-reports-and-analytics.md`, wastage is included:
- Total wastage cost (val × unit cost)
- Wastage by item type
- Wastage trend (daily/weekly/monthly)
- Variance: expected vs actual food cost

---

## 28.3 Recipe-Based Stock Deduction

### 28.3.1 Automatic Deduction

**When an order is submitted** (per `05_bounded-contexts.md` and `06_domain-modeling-patterns.md`):

1. **OrderEvent::OrderSettled** emitted from Ordering context
2. **Inventory context** receives event → iterates order items
3. **For each item**, look up recipe mapping (menu_item_id → stock_items + quantities)
4. **Decrement** `stock_items.current_qty` by `recipe.unit_qty × order.quantity`
5. **If** `current_qty` `<` `reorder_point` → emit `StockReorderAlert`
6. **If** `current_qty` `<` 0 → flag as discrepancy (allow negative in-flight; reconcile on next stock count)

**Example**: Butter Chicken recipe requires 2 beef patties per order.
- Order: 3x Butter Chicken → 6 beef patties deducted
- Stock had 10 patties → now 4
- If recipe called for 15 patties → stock goes to -5 (in-flight); next physical count reconciles

### 28.3.2 Recipe Management

**From dashboard** (`/menu` → select item → "Recipe" tab):

| Field | Description |
|---|---|
| **Menu Item** | Linked menu item |
| **Stock Item** | Which stock item this recipe deducts |
| **Qty per Menu Item** | How much of this stock item per menu item order |
| **Unit of Measure** | Must match stock item's `unit_qty` |
| **Conversion Factor** | If recipe unit ≠ stock base unit |

**Example**: "Chicken Curry" menu item
- Stock item: "Beef Patty" (wait, typo - should be "Chicken Thigh")
- Actually: Stock item: "Chicken Thigh", `unit_qty`: "each"
- Qty per menu item: `2` (2 thighs per curry)
- Conversion factor: `1` (each = each, no conversion)

---

## 28.4 Physical Inventory Count

### 28.4.1 Count Procedure

**Periodic physical count** (weekly, monthly, or per restaurant policy):

1. **Schedule count** via dashboard (`/inventory` → "Schedule Count")
2. **Print count sheets** or use tablet; assign counters to items
3. **Count all items** in the restaurant/location
4. **Enter counts** into the system (one-by-one or bulk upload CSV)
5. **System compares** entered count vs `current_qty`
6. **Discrepancies** highlighted; option to "Adjust Stock" (see 28.1.3)
7. **Mark count complete**; `last_counted_at` updated to today

### 28.4.2 Count Verification

| Scenario | Action |
|---|---|
| **Count matches system** | No action; `last_counted_at` updated |
| **Count differs by ≤ 5%** | System prompts "Adjust stock?"; if confirmed, adjust (28.1.3) |
| **Count differs by > 5%** | Mandatory adjustment required; investigate cause (theft, spoilage, data error) |
| **Count differs by > 20%** | Escalate to manager; possible systemic issue; recount next week |

---

## 28.5 Inventory Reports

### 28.5.1 Inventory Valuation (in Z-Report)

Per `30-z-reports-and-analytics.md`, inventory valuation includes:

| Field | Calculation |
|---|---|
| **Total Inventory Value** | `SUM(current_qty × unit_cost)` across all items |
| **Cost Per Unit** | Configured per item (can differ from POS price) |
| **Potential Value** | `SUM(maximum_qty × unit_cost)` (if at max stock) |
| **Wastage Value** | Sum of `WastageRecorded` events × unit cost (period) |

### 28.5.2 Stock Turnover Ratio

**Formula**: `COGS / Average Inventory Value`

**Where**:
- **COGS** (Cost of Goods Sold): Total value of items removed via recipe deduction + wastage, over period
- **Average Inventory Value**: `(Beginning Inventory + Ending Inventory) / 2`

**Dashboard display**: Stock turnover ratio per item and overall; benchmark against restaurant type (QSR: 4-6x/month, Fine Dining: 1-2x/month).

---

## 28.6 Next Steps

After managing inventory:

1. **Read** `29-shift-management.md` for shift close and inventory reconciliation
2. **Read** `30-z-reports-and-analytics.md` for inventory in sales reports
3. **Read** `27_menu-management.md` to see menu-to-stock mappings

---
*This file is part of the PlinthOS end user documentation set.*