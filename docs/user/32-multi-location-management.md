# 32-multi-location-management.md - Managing Multiple Restaurant Locations

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `26_dashboard-user-guide.md` (dashboard context for multi-location)
- `28-inventory-and-stock.md` (stock tracking per location)
- `30-z-reports-and-analytics.md` (cross-location reporting)
- `AGENTS.md` (multi-tenant isolation mandate)

---

## 32.1 Tenant and Location Overview

### 32.1.1 Tenant vs. Location

| Concept | Description | Identifier |
|---|---|---|
| **Tenant** | Legal entity / restaurant brand | `tenant_42`, `tenant_99` |
| **Location** | Physical site within a tenant | `loc_01`, `loc_02`, `loc_10` |
| **Relationship** | One tenant can have multiple locations | `tenant_42` → `loc_01`, `loc_02` |

### 32.1.2 Switching Locations

**From the dashboard** (`/dashboard` or any page), the location selector is in the top-right:

1. **Click location dropdown** (current location displayed, e.g., "Downtown Bistro - loc_01")
2. **Select different location** from the list
3. **System filters** all data (menu, inventory, orders, reports) to the selected location
4. **User permissions** apply per location (per `31-staff-permissions-and-roles.md`)

**From the POS** (quick start, 21.1):
1. **On login**, location selection screen appears
2. **Choose site** associated with your JWT token's `x-tenant-id` and `x-location-id`
3. Only locations you have permission for appear

### 32.1.3 Multi-Location Home Dashboard

When "All Locations" mode (Admin only), the dashboard home shows:

| Widget | Data |
|---|---|
| **Revenue (All Locations)** | Combined revenue across all sites for current period |
| **Open Checks (Total)** | Sum of active orders across all locations |
| **Low Stock (Aggregated)** | Items below reorder point, anywhere in tenant |
| **KDS Tickets (Total)** | Total pending tickets across all KDS stations |
| **Location Switcher** | Quick toggle between individual locations |

---

## 32.2 Catalog Management Across Locations

### 32.2.1 Menu Synchronization

**Three modes** for menu management across locations (configured in `/menu` → **"Synchronization Settings"**):

| Mode | Description | Use Case |
|---|---|---|
| **Centralized** | Head office edits; changes propagate to all locations | Chain restaurants, identical menus |
| **Per-Location** | Each location manages its own menu independently | Restaurants with local specialties |
| **Hybrid** | Core menu centralized; location-specific items added/86'd locally | Most common: signature dishes + local additions |

### 32.2.1.1 Centralized Mode

- **Head office** (Admin role) edits menu items
- **Propagation**: Changes push to all locations via WebSocket (Durable Object broadcast)
- **Override**: Individual locations can 86 or modify items; changes are local only (not propagated up)
- **Conflict**: Head office change → local override → merge conflict resolved by timestamp (LWW)

### 32.2.1.2 Per-Location Mode

- Each `/menu` page shows only that location's items
- No propagation; changes isolated per site
- Useful for: different menus for different concepts (e.g., food hall tenants)

### 32.2.1.3 Hybrid Mode (Recommended)

- **Core menu** (signature items, pricing, tax rates) managed at head office
- **Local items** (daily specials, local adaptations) managed at each location
- **86 operations**: Head office 86 propagates; local 86 stays local

---

## 32.3 Cross-Location Reporting

### 32.3.1 Aggregated Reports

**In** `/reports`, the date range picker includes:

| Aggregation Level | What It Shows |
|---|---|
| **This Location** | Data for the currently selected site only |
| **All Locations (Tenant)** | Combined data across all sites in the tenant |
| **Compare Locations** | Side-by-side chart: select 2-4 locations to compare |

### 32.3.2 Comparison Metrics

| Metric | Description |
|---|---|
| **Revenue Comparison** | Total sales per location, overlaid line chart |
| **Order Volume** | Orders/day per location |
| **Average Ticket** | Per-location avg order value |
| **Payment Mix** | Cash/card/UPI percentages per location |
| **Top Items** | Each location's best-selling items |
| **86 Rate** | Each location's item unavailability rate |

### 32.3.3 Export Cross-Location Data

**CSV/Excel export** includes a `location_id` column; filter/post-process as needed.

---

## 32.4 Inventory Across Locations

### 32.4.1 Stock Tracking Per Location

**Per `28-inventory-and-stock.md`**, each stock item has `tenant_id` + `location_id`.

**Queries**:
- **Single location**: `WHERE location_id = 'loc_01'`
- **Tenant-wide**: `WHERE tenant_id = 'tenant_42'` (sum across all locations)
- **Out of stock anywhere**: `WHERE current_qty <= reorder_point` (returns all locations with low stock)

### 32.4.2 Centralized Reordering

**In hybrid/synchronized inventory**:

1. **Low stock alert** from any location propagates to all locations (via CRDT sync)
2. **Head office** can place purchase orders that apply to all locations
3. **Location-specific reordering**: Each location places its own order; no cross-location transfer built-in (manual workarounds via stock adjustments)

---

## 32.5 User Per-Location Restrictions

| Action | Cashier | Manager | Supervisor | Admin |
|---|---|---|---|---|
| **Switch location** | Own location only | Own location + adjacent sites | All locations | All locations |
| **Edit menu** | No | Own location | Own location | All locations (centralized/hybrid) |
| **Adjust inventory** | No | Own location | Own location | All locations |
| **View reports** | Own shifts only | Own location | All locations | All locations + tenant-wide |
| **Generate Z-Report** | Own shift only | Own location + adjacent | All locations | All locations + tenant-wide |

---

## 32.6 Common Multi-Location Scenarios

| Scenario | Configuration | Notes |
|---|---|---|
| **3-location food hall** | Per-location menu; shared KDS; centralized inventory for shared items (e.g., drinks) | Each tenant has own menu; 1 KDS for all |
| **3-location chain** | Centralized menu; each location manages its own inventory; weekly sync | Identical menus; separate stock per site |
| **2-location different concepts** | Hybrid: shared core menu; local specialties per site | E.g., one QSR, one fine dining |
| **New location launch** | Clone existing location's menu/inventory; then customize | Use "Duplicate Location" in dashboard settings |

---

## 32.7 Next Steps

After managing multiple locations:

1. **Read** `28-inventory-and-stock.md` for cross-location stock tracking
2. **Read** `30-z-reports-and-analytics.md` for aggregated reporting
3. **Read** `31-staff-permissions-and-roles.md` for role restrictions per location

---
*This file is part of the PlinthOS end user documentation set.*