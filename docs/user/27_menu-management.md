# 27_menu-management.md - Menu Management for Managers

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `26_dashboard-user-guide.md` (dashboard context)
- `21_pos-quick-start.md` (POS item selection)
- `28-inventory-and-stock.md` (menu-to-stock mapping)
- `30-z-reports-and-analytics.md` (menu performance reporting)

---

## 27.1 Adding New Menu Items

### 27.1.1 Item Creation Form

From the dashboard navigation (`/menu` → **"Add Item"**), the following fields are required:

| Field | Type | Description | Example |
|---|---|---|---|
| **Name** | Text | Display name on POS | "Butter Chicken" |
| **Category** | Select | Hierarchical category | "Main Courses" > "Curries" |
| **Base Price** | Integer (cents) | Pre-tax price in minor units | `34000` (= $340.00) |
| **Tax Rate** | Select | GST applicability | `GST-5` (5%), `GST-0`, `GST-10`, `GST-15` |
| **Is 86'd** | Toggle | marks item unavailable | Off (default) / On |
| **Photo** | Upload | JPEG/PNG; displays on POS | `/images/butter-chicken.jpg` |
| **Modifier Groups** | Table | See 27.2 | See below |
| **Effective From** | Date | Start date for this price | Today's date |
| **Effective To** | Date | End date (for seasonal items) | null = permanent |

### 27.1.2 Step-by-Step: Adding a New Item

1. **Navigate** to `/menu` in the dashboard
2. **Click "Add Item"** in the top action bar
3. **Fill in the form**:
   - Name: "Chocolate Fudge Cake"
   - Category: "Desserts"
   - Base Price: `28000` ($280.00 - premium dessert)
   - Tax Rate: `GST-10` (10% applicable)
   - Is 86'd: Off
   - Photo: Upload cake image
   - Modifier Groups: "Slice Size" (Small/Medium/Large with price deltas)
   - Effective From: today; Effective To: leave blank
4. **Click "Save"**
5. **Item appears** in the menu list with status "Active"
6. **POS immediately** reflects the new item (cache invalidation via WebSocket)

### 27.1.2 Bulk Menu Import

**For chain restaurants** with identical menus across locations:

1. **Download template** CSV from `/menu/import-template`
2. **Fill CSV** with items (name, category, price, tax, modifiers config)
3. **Upload CSV** via `/menu/import`
4. **System validates** each row; reports errors for malformed rows
5. **Successful items** added; **failed items** shown in review table
6. **Preview** before commit: review all items, then "Confirm Import"

**CSV Column Mapping**:
| Column | Meaning |
|---|---|
| `name` | Item display name |
| `category_path` | Hierarchical: "Main Courses/Curries" |
| `base_price_cents` | Integer, e.g., `34000` |
| `tax_rate` | `GST-0`, `GST-5`, `GST-10`, `GST-15` |
| `is_86_d` | `true` / `false` |
| `modifier_config_json` | See 27.2 for structure |

---

## 27.2 Modifier Groups Configuration

### 27.2.1 Creating Modifier Groups

**From the menu item edit page**, under **"Modifier Groups"**:

| Field | Description | Example |
|---|---|---|
| **Group Name** | Display name | "Spice Level" |
| **Type** | Single-select or Multi-select | Single / Multi |
| **Required** | Must select at least one | On / Off |
| **Modifiers** | Individual modifier items | See below |
| **Price Delta** | Added to base price per modifier | `+$0.00`, `+$1.50`, `-$0.50` |

### 27.2.2 Creating Individual Modifiers

**Within a modifier group**, add each modifier:

| Field | Description | Example |
|---|---|---|
| **Modifier Name** | Display name on POS | "Mild", "Medium", "Spicy" |
| **Price Delta** | Cost addition/removal | `+$0.00` (included), `+$1.00` (upcharge), `-$0.50` (discount) |
| **Is Default** | Auto-selected if user doesn't choose | On / Off |
| **Allergy Warning** | Shows on KDS if selected | "Contains nuts" / none |

**Example**: "Spice Level" group with 3 modifiers:

| Modifier | Price Delta | Default | Allergy Warning |
|---|---|---|---|
| Mild | `+$0.00` | Yes | No |
| Medium | `+$0.50` | No | No |
| Spicy | `+$1.00` | No | "Contains chili extract" |

### 27.2.3 Modifier Rules (Configuration)

| Rule Type | Behavior |
|---|---|
| **Single Select** | Customer chooses exactly one from the group; required = must choose one |
| **Multi Select** | Customer can choose multiple (0+); required = must choose at least one |
| **Required** | Gray out "Proceed" button until at least one modifier selected |
| **Optional** | Customer can skip the entire group |
| **Price Delta Cumulative** | Modifiers with positive deltas add up; mixed positive/negative possible |
| **Max Modifiers** | Configurable limit (e.g., "max 3 modifiers per item") |

---

## 27.3 Pricing Strategies

### 27.3.1 Price Scheduling

**For seasonal items, happy hours, or time-based pricing**:

1. **Set Effective From/To dates** on the item form (see 27.1.1)
2. **Outside the date range**: Item appears grayed out on POS with "Seasonal - Available mm/dd/yyyy" note
3. **Inside the date range**: Item behaves normally

**Example**: "Valentine's Day Chocolate Lovers Package"
- Effective From: Feb 1
- Effective To: Feb 14
- After Feb 14: Item auto-86's (is_86'd = true) and displays "Available next Feb 1"

### 27.3.2 Tiered Pricing by Size

**Using modifier groups for size tiers**:

| Size | Modifier | Price Delta | Portion |
|---|---|---|---|
| Small | Small | `+$0.00` | 8oz |
| Medium | Medium | `+$2.00` | 12oz |
| Large | Large | `+$4.00` | 16oz |

**Customer experience on POS**:
1. Item button tapped → modifier selection screen appears
2. Customer selects "Medium" → price updates to base + $2.00
3. Ticket kitchen receives correct portion instructions

---

## 27.4 Item Status: Active / 86'd / Archived

| Status | Visual on POS | Behavior |
|---|---|---|
| **Active** | Normal button color; selectable | Customers can order; kitchen receives tickets |
| **86'd** | Button grays out; shows "86" badge | Customers cannot select; existing orders unaffected; new orders cannot include |
| **Archived** | Button hidden; item not in POS menu search | Historical; used for record-keeping; never selectable |

### 27.4.1 86'ing an Item (Making Unavailable)

**Reasons to 86**:
- Out of stock (temporary)
- Ingredient recall
- Seasonal removal
- Dish being reformulated

**Procedure**:
1. In dashboard `/menu`, locate the item
2. Toggle **Is 86'd** switch to On
3. Item immediately grays out on POS
4. **Toast notification**: "Item 86'd - unavailable until restored"
5. **Emits event**: Item availability change → syncs to KDS and all POS terminals

**To restore**: Toggle switch Off; item reappears on POS.

### 27.4.2 Archiving an Item

**For historical record-keeping** (never used in new orders):

1. In dashboard, locate item
2. Change status to "Archived" (via three-dot menu → "Archive")
3. Item removed from POS menu search
4. Still queryable in reports (sales of archived items, past date range)
5. **Audit trail**: Who archived, when, reason (logged in `audit_events`)

---

## 27.5 Menu Item Tax Configuration

### 27.5.1 Tax Rate Selection

Per-item tax rate overrides the default restaurant tax rate (set in dashboard settings).

| Tax Rate | Description | When Applied |
|---|---|---|
| `GST-0` | 0% GST | Essential items, certain foods (varies by jurisdiction) |
| `GST-5` | 5% GST | Standard rate for most prepared foods |
| `GST-10` | 10% GST | Prepared foods, some beverages |
| `GST-15` | 15% GST | Luxury items, specific categories |

**Per-item override** takes precedence over restaurant-level default.

### 27.5.2 Tax Exemption

**For tax-exempt customers** (e.g., government accounts, charities):

1. **At POS checkout**, tap "Tax Exempt"
2. **System sets** `tax_applicability = Exempt` for that order
3. **Line items** show $0 tax; order total excludes GST
4. **Audit log**: `tax_exemption` event recorded with customer ID
5. **Requires**: Supervisor authorization (JWT validation) per `AGENTS.md` mandate

---

## 27.5 Menu Performance Reporting

**In** `30-z-reports-and-analytics.md`, reports include:

| Metric | Description |
|---|---|
| **Top 10 Items** | Most ordered items (by quantity) across selected period |
| **Modifier Popularity** | Which modifiers selected most often (e.g., "Medium Spicy" 42% of orders) |
| **Price Point Analysis** | Revenue by price range ($0-10, $10-20, $20-30, etc.) |
| **86 Rate** | Percentage of time item was 86'd during period |
| **Photo View Count** | How often POS customers viewed item photo (new in V2) |
| **Effective Date Performance** | Compare sales before/after price change date |

**Example report query**:
```
SELECT 
  menu_items.name,
  COUNT(order_line_items.id) as total_ordered,
  SUM(order_line_items.quantity) as total_units,
  AVG(order_line_items.unit_price_cents) as avg_price_cents
FROM order_line_items
JOIN menu_items ON order_line_items.menu_item_id = menu_items.id
WHERE order_line_items.created_at BETWEEN '2026-08-01' AND '2026-08-28'
GROUP BY menu_items.id, menu_items.name
ORDER BY total_ordered DESC
LIMIT 10;
```

---

## 27.6 Next Steps

After managing menus:

1. **Read** `28-inventory-and-stock.md` to map menu items to stock
2. **Read** `30-z-reports-and-analytics.md` to see menu performance analytics
3. **Read** `21_pos-quick-start.md` to see how menu items appear on POS

---
*This file is part of the PlinthOS end user documentation set.*