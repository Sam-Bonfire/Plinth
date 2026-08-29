# 26_dashboard-user-guide.md - Back-Office Dashboard User Guide

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (POS context)
- `22_order-taking-workflow.md` (order creation)
- `23-payment-processing.md` (payment flow)
- `29-shift-management.md` (shift operations)
- `31-staff-permissions-and-roles.md` (role-based access)

---

## 26.1 Dashboard Layout and Navigation

### 26.1.1 Main Dashboard Screen

Upon logging into the PlinthOS back-office dashboard (`http://localhost:5173` or deployed URL), the user sees:

| Screen Area | Description |
|---|---|
| **Top Navigation Bar** | Logout, user profile, notifications, company logo |
| **Left Sidebar** | Nav menu: Dashboard, Menu, Inventory, Shifts, Reports, Staff |
| **Main Content Area** | Dynamic pages based on sidebar selection |
| **Footer** | Version info, support links, feedback |

### 26.1.2 Role-Based View Customization

**Dashboard visibility** depends on staff role (see `31-staff-permissions-and-roles.md`):

| Role | Visible Sidebar Items |
|---|---|
| **Cashier** | Dashboard (overview), Orders (own orders only) |
| **Manager** | All items except Staff Management |
| **Supervisor** | All items |
| **Admin** | All items + System Settings |

**Customizing view**:
1. Click the **gear icon** (⚙️) in the top navigation
2. Select **"Customize Dashboard"**
3. **Drag and drop** widgets to rearrange
4. **Hide/show** modules per role
5. **Save** layout

---

## 26.2 Dashboard Pages

### 26.2.1 Dashboard Home (`/`)

**Overview summary** for the current shift/date:

| Widget | Data Shown |
|---|---|
| **Open Checks** | Number of active/unsettled orders |
| **Revenue Today** | Total sales (cash + card + UPI) since midnight |
| **Active Tickets** | Count of KDS tickets with SLA status (green/yellow/red) |
| **Low Stock Alerts** | Items below reorder point (count + list) |
| **Upcoming Shifts** | Next 3 shift start times |

**Actions**:
- Click **Open Checks** → jumps to orders screen
- Click **Revenue Today** → jumps to Z-Report partial
- Click **Low Stock Alerts** → jumps to inventory screen with pre-filtered items

### 26.2.2 Menu Management (`/menu`)

**See** `27_menu-management.md` for full menu management workflow.

**Key features**:
- **List view**: All menu items with status (active/86'd/archived)
- **Add item**: Form with name, price, category, tax rate, photo upload
- **86/Unavailable**: Toggle switch to mark item unavailable
- **Modifier groups**: Configure modifier selection rules (single/multi, required/optional)
- **Price scheduling**: Effective start/end dates for price changes
- **Category hierarchy**: Drag-and-drop reordering; parent/child categories

### 26.2.3 Inventory & Stock (`/inventory`)

**See** `28-inventory-and-stock.md` for full inventory workflow.

**Key features**:
- **Stock level grid**: All stock items with `current_qty` vs `reorder_point`
- **Reorder alerts**: Items in red below threshold; click to view details
- **Physical count**: Form to record new stock count; compares to `current_qty`
- **Recipe mapping**: View/edit which stock items map to which menu items
- **Wastage entry**: Record spoilage/trim; separate from normal recipe deductions

### 26.2.4 Shift Management (`/shifts`)

**See** `29-shift-management.md` for full shift workflow.

**Key features**:
- **Current shift banner**: "Shift Open Since 08:00 — 3.5 hours elapsed"
- **Open Shift** button: Starts new shift, verifies float
- **Close Shift** button: Generates Z-Report (see `30-z-reports-and-analytics.md`)
- **Shift history**: List of past 30 shifts with revenue, variance, operator
- **Float adjustment**: Manual correction of opening float (requires supervisor auth)

### 26.2.5 Reports & Analytics (`/reports`)

**See** `30-z-reports-and-analytics.md` for full reporting workflow.

**Key features**:
- **Date range picker**: Custom date range for reports
- **Report types**:
  - **Sales Summary**: Daily/weekly/monthly revenue by channel
  - **Payment Breakdown**: Cash/ card/ UPI percentages
  - **Tip Analytics**: Total tips, distribution, per-server estimates
  - **Product Performance**: Most ordered items, modifiers, course stages
  - **Custom SQL** (Admin only): Run arbitrary queries against D1 (read-only)
- **Export formats**: CSV, Excel, PDF
- **Schedule**: Automated weekly/monthly report email delivery

### 26.2.6 Staff Permissions & Roles (`/staff`)

**See** `31-staff-permissions-and-roles.md` for full permissions workflow.

**Key features**:
- **Role list**: Cashier, Manager, Supervisor, Admin
- **Permission bitmask**: Visual toggle grid (16-bit mask shown as checkboxes)
- **Add/Edit Staff**: Name, role, location assignment, login credentials
- **Permission search**: Filter by action (e.g., "can void orders", "can manage menu")
- **Audit log**: View recent permission changes; who, when, what changed

---

## 26.3 Search and Filtering

### 26.3.1 Global Search

**Top-right search bar** (`Ctrl+K` / `Cmd+K`):

- **Search items**: Menu items, stock items, staff names
- **Search orders**: Order ID, table number, status
- **Search shifts**: Shift date, operator name
- **Results**: Highlighted with context snippets; click to navigate

### 26.3.2 Page-Specific Filters

| Page | Available Filters |
|---|---|
| **Menu** | Status (active/86'd/archived), category, price range, search name |
| **Inventory** | Low stock (< reorder point), out of stock, by location, by last counted date |
| **Shifts** | Date range, operator, open/closed, variance range |
| **Reports** | Date range, location, channel (dine-in/takeout/delivery), metric type |
| **Staff** | Role, location, active status, name search |

---

## 26.4 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl+/⌘+/** | Open global search |
| **N** | New order (from dashboard home) |
| **M** | Open menu management |
| **I** | Open inventory screen |
| **S** | Open shifts screen |
| **R** | Open reports screen |
| **Y** | Open staff permissions |
| **Esc** | Close open modals/dialogs |
| **F5** | Refresh current page |
| **Ctrl+S** | Save form (if in edit mode) |

---

## 26.5 Troubleshooting Dashboard Issues

| Issue | Cause | Resolution |
|---|---|---|
| "Page not loading" | Network interruption; API proxy down | Check `PLINTH_ENV`; refresh; if persistent, contact admin |
| "Permission denied" | Role doesn't have access to this page | Verify role assignment in `/staff`; request appropriate role |
| "Data stale" | Dashboard not auto-refreshing | Dashboard auto-refs every 30s; pull to refresh (mobile) or click refresh |
| "Wrong role visible" | Incorrect role assignment | Admin: edit staff role in `/staff`; logout/login to refresh permissions |
| "Search returns no results" | Wrong filter applied; term not in database | Clear filters; check spelling; ensure item is not 86'd/inactive |

---

## 26.6 Next Steps

After mastering the dashboard:

1. **Read** `27_menu-management.md` for detailed menu configuration
2. **Read** `28-inventory-and-stock.md` for stock control
3. **Read** `29-shift-management.md` for shift close/Z-Report procedures
4. **Read** `30-z-reports-and-analytics.md` for sales analytics
5. **Read** `31-staff-permissions-and-roles.md` for role-based access control

---
*This file is part of the PlinthOS end user documentation set.*