# 31-staff-permissions-and-roles.md - Staff Permissions and Role Management

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `26_dashboard-user-guide.md` (dashboard context)
- `29-shift-management.md` (shift operations tied to roles)
- `30-z-reports-and-analytics.md` (report access per role)
- `AGENTS.md` (permission bitmask mandate)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 31.1 Role Definitions

PlinthOS uses **four primary roles**, each with a distinct permission bitmask. Roles are assigned per staff member in the dashboard (`/staff`).

| Role | Code Name | Description | Typical Staff |
|---|---|---|---|
| **Cashier** | `cashier` | Frontline order taking, payments | Servers, cashiers, baristas |
| **Manager** | `manager` | Full site operations, supervisory | Restaurant managers, shift leads |
| **Supervisor** | `supervisor` | Override authority, analytics | Senior staff, floor supervisors |
| **Admin** | `admin` | System-wide configuration, all access | Corporate office, owner |

### 31.1.1 Permission Bitmask (per `AGENTS.md`)

Each role has a **16-bit permission bitmask**. Bits are set/cleared per restaurant configuration; no bit is universally fixed.

| Bit | Default Assignment | Typical Power | Example Actions |
|---|---|---|---|
| `0` (`1`) | Cashier | `TAKE_ORDER` | Place orders, modify items |
| `1` (`2`) | Cashier | `MANAGE_MENU` | Add/86 items, modify pricing |
| `2` (`4`) | Cashier | `VOID_ORDERS` | Void orders (requires supervisor if set) |
| `3` (`8`) | Manager | `FAST_TRACK` | Bypass KDS state machine |
| `4` (`16`) | Manager | `MANAGE_STAFF` | Hire/fire, assign roles |
| `5` (`32`) | Manager | `VIEW_FINANCIALS` | Z-Reports, revenue analytics |
| `6` (`64`) | Supervisor | `OVERRIDE_INVARIANTS` | Override seat balance, discount limits |
| `7` (`128`) | Admin | `MANAGE_SYSTEM` | Users, roles, system settings |
| `8` (`256`) | Admin | `VIEW_AUDIT_LOG` | All audit events |
| `9` (`512`) | Admin | `MANAGE_D1_SCHEMA` | Add/migrations DB columns |
| `10` (`1024`) | | | |
| `11` (`2048`) | | | |
| `12` (`4096`) | | | |
| `13` (`8192`) | | | |
| `14` (`16384`) | | | |
| `15` (`32768`) | | | |

**Bitmask logic**: `(permissions & bit) ≠ 0` → role has that permission.

**Example**: A Manager might have bits `0|1|2|4|5|6` = `TAKE_ORDER | MANAGE_MENU | VOID_ORDERS | FAST_TRACK | VIEW_FINANCIALS | OVERRIDE_INVARIANTS`.

---

## 31.2 Role-Based Access Control (RBAC) in the Dashboard

### 31.2.1 Dashboard Page Visibility

| Dashboard Page | Cashier | Manager | Supervisor | Admin |
|---|---|---|---|---|
| **Home** | Yes | Yes | Yes | Yes |
| **Menu** | Read-only (view items) | Full (add/86/edit) | Read-only | Full + system config |
| **Inventory** | View only | Full (adjust, reorder) | View + adjust low stock | Full |
| **Shifts** | View own | Open/close own + view others | Open/close any + handover | All + reopen |
| **Reports** | View own Z-Reports | All shifts in location | All shifts + all locations | All + custom SQL |
| **Staff** | No | Add/edit own location | Edit own role | All + role management |
| **Settings** | No | No | No | All |

### 31.2.2 In-Permission Checks (Code Level)

**Per `08_typescript-standards.md` and `07_rust-safety-mandates.md`**, every API handler and React component checks permissions:

**Rust (edge API)**:

```rust
use core_domain::enums::staff::Permissions;

#[middleware]
async fn check_permission<F>(permissions: Permissions, handler: F) -> Result<Response, Response>
where
    F: FnOnce() -> Response,
{
    let ctx = get_current_context(); // extracts tenant_id, location_id, JWT claims
    let user_permissions = ctx.permissions; // from JWT `permissions` field
    
    if (user_permissions.bits() & permissions.bits()) == permissions.bits() {
        // User has all required bits → proceed
        handler()
    } else {
        // Insufficient permissions
        json_error("Insufficient permissions", "FORBIDDEN", &get_request_id(&req), 403)?
    }
}
```

**React (dashboard)**:

```tsx
import { usePermissions } from '@/lib/permissions';

function MenuManagement() {
  const { canManageMenu, canDeleteItems } = usePermissions();
  
  return (
    <div>
      {canManageMenu && <AddItemForm />}
      {canDeleteItems && <DeleteItemButton />}
      {/* Always visible: */}
      <ViewItemList />
    </div>
  );
}
```

### 31.2.3 Permission Denied UI

When a user lacks permission:

| Context | Message | Action |
|---|---|---|
| **Dashboard page** | "You don't have permission to view this page" | Redirect to home/dashboard |
| **Button/action** | Greyed out / hidden | No UI element shown |
| **API call** | `403 Forbidden` response | Toast: "Insufficient permissions"; log event |
| **Shift close** | "Manager authorization required" | Prompt for manager JWT/password |

---

## 31.3 Role Assignment and Modification

### 31.3.1 Assigning Roles

**From dashboard** (`/staff` → **"Add Staff"** or edit existing):

1. **Enter staff name** and **email**
2. **Select role**: Cashier / Manager / Supervisor / Admin
3. **Assign location(s)**: Which restaurant site(s) this staff member can access
4. **Configure bitmask** (optional): Click bit toggles to customize permissions beyond the default role set
5. **Send invitation**: Email sent with onboarding link and role-specific UI

### 31.3.2 Modifying Permissions

**Existing staff** can have their bitmask adjusted:

1. Navigate to `/staff`, locate the staff member
2. Click **"Edit Permissions"**
3. **Toggle bits** on/off (descriptive labels shown: "Can void orders", "Can manage menu", etc.)
4. **Save**; new permissions take effect immediately (next login required for some changes)
5. **Audit log** entry created: "Staff permissions updated: Staff ID X, bits changed: 0, 3, 5"

### 31.3.3 Permission Change Workflow

| Change Type | Approval Required | Audit Logged |
|---|---|---|
| **Bit toggle** (add/remove single permission) | None (immediate) | Yes |
| **Role promotion** (Cashier → Manager) | Manager+ approval (or Admin) | Yes |
| **Role demotion** | Same | Yes |
| **Bitmask reset to role default** | Manager+ approval | Yes |

---

## 31.4 Common Permission Combinations

| Use Case | Recommended Role + Bits |
|---|---|
| **Full restaurant manager** | Manager + bits: `0|1|2|4|5|6` (take order, manage menu, void orders, fast track, view financials, override invariants) |
| **Shift supervisor** | Supervisor + bits: `3|5|7` (fast track, view financials, override invariants) |
| **Head cashier** | Cashier + bits: `0|1|3` (take order, manage menu, fast track) |
| **Bar staff** | Custom bits: `0|1|8|9` (take order, manage menu, manage system, view audit log) |
| **Kitchen display operator** | Custom bits: `2|5` (view financials, override invariants for KDS) |

---

## 31.5 Auditing Permission Changes

All permission modifications are logged in `audit_events` (per `19_database-schema.md`):

| Field | Example |
|---|---|
| `actor_id` | `staff-842` (who made the change) |
| `action` | `staff_permission_update` |
| `details_json` | `{"old_bits": 21, "new_bits": 23, "changed_bits": [1, 2], "staff_id": "842", "role": "manager"}` |
| `created_at` | `2026-08-28T14:30:00Z` |

**Viewable** in dashboard (`/staff` → **"Audit Log"**) and via API: `GET /api/v1/audit/logs?action=staff_permission_update`.

---

## 31.6 Next Steps

After understanding staff permissions:

1. **Read** `29-shift-management.md` for how permissions affect shift operations
2. **Read** `30-z-reports-and-analytics.md` for report access levels
3. **Read** `26_dashboard-user-guide.md` for role-based dashboard customization

---
*This file is part of the PlinthOS end user documentation set.*