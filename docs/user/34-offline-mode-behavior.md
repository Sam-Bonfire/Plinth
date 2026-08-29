# 34-offline-mode-behavior.md - Offline-First Operation Guide

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (POS operates locally)
- `25-kds-kitchen-interaction.md` (KDS offline behavior)
- `14_sync-protocol.md` (CRDT sync mechanics)
- `DEVELOPER-NAVIGATION.md` (master navigation)

---

## 34.1 How the System Works Without Network

PlinthOS is **offline-first** by design. The core principle: **local writes complete in <1ms**; network replication happens in the background.

### 34.1.1 What Happens When Network Is Lost

| Component | Behavior Offline |
|---|---|
| **POS Terminal** | Accepts all orders, payments, item modifications; saves to local SQLite |
| **KDS Display** | Shows tickets from last sync; SLA timers run on local system time |
| **Dashboard** | Shows last-synced data; greyed-out features requiring API |
| **Inventory** | Stock levels from last sync; manual adjustments allowed |
| **Printer** | Queued print jobs held locally; prints when connection restores |

### 34.1.2 Functional Continuity

| Use Case | Offline Behavior |
|---|---|
| **Taking orders** | Full order creation; item selection, modifiers, notes all work |
| **Payment processing** | Cash and split payments work; card/UPI requires network (shown as "offline disabled") |
| **Menu selection** | Active items available; 86'd items still grayed out (stored locally) |
| **KDS ticket creation** | Tickets created locally; queued for sync when network restores |
| **Stock deductions** | Recipe deductions buffered locally; applied when network restores |
| **Z-Report generation** | Possible locally (offline Z-Report); noted as "offline Z-Report" |

### 34.1.3 Visual Indicators

| Indicator | Meaning |
|---|---|
| **Top banner**: "Offline mode" | Network connectivity lost |
| **Badge on KDS ticket**: "📡 Offline" | Ticket created locally |
| **Grayed menu items**: 86'd items remain unavailable |
| **Button label**: "Save locally" | Explicit action for data that requires network |

---

## 34.2 Sync Restoration When Network Returns

### 34.2.1 Automatic Sync Process

1. **Network detects restoration** (TCP keepalive, DNS resolution succeeds)
2. **Tokio sync daemon** resumes background thread
3. **Pending mutations** flushed via WebSocket to Durable Object (DO)
4. **DO broadcasts** mutations to all connected replicas
5. **D1 batched replication** (every 5s or on settlement) updates all database copies
6. **Vector clocks** merged; conflicts resolved (LWW or domain-specific)
7. **UI shows**: "Syncing..." banner → "Synced" when complete
8. **Data consistency**: All replicas converge to same state (CRDT guarantee)

### 34.2.2 Sync Conflict Handling

**When vector clocks are incomparable** (concurrent edits offline):

| Conflict Type | Example | Resolution |
|---|---|---|
| **Stock quantity** | Two users adjust same stock item offline | PN Counter merge: net increment/decrement applied; if still conflicting, status=`conflict` |
| **Order modification** | Two cashiers add different items to same order | LWW (latest `created_at` wins); or manual review via "Conflict Resolution" screen |
| **Ticket status** | Two chefs bump different tickets simultaneously | Last-write-wins based on timestamp; audit log entry created |

**Manual conflict resolution** (via dashboard):
1. Navigate to `/sync-conflicts`
2. Review conflicting changes
3. Select "Keep Local" or "Keep Server" or "Merge"
4. System reapplies; status → `settled`

---

## 34.3 Offline Data Limitations

| Data Type | Available Offline | Behavior When Offline |
|---|---|---|
| **Order creation** | ✅ Full functionality | All fields saved locally |
| **Payment (Cash/Split)** | ✅ Full functionality | No network required |
| **Payment (Card/UPI)** | ❌ Disabled | UI shows "Offline - Card requires network" |
| **Menu item selection** | ✅ Active items only | 86'd items remain unavailable |
| **KDS ticket creation** | ✅ Full functionality | Tickets queued for sync |
| **Stock deduction** | ✅ Buffered locally | Applied on sync; may go temporarily negative |
| **Z-Report generation** | ✅ Offline Z-Report | Marked "offline"; data synced later |
| **Inventory reorder alerts** | ✅ Visible locally | Triggered locally; synced later |
| **Menu 86 operations** | ✅ Local only | 86 propagates on sync; not immediate |

---

## 34.4 Best Practices for Offline Operation

### 34.4.1 Before Going Offline

| Checklist Item | Purpose |
|---|---|
| **Verify local SQLite database** is not corrupted | `cargo run --bin verify_db` (if available) |
| **Print critical reports** (current Z-Report, inventory count) | Preserve data before loss of network |
| **Note open checks** and their status | Ensure smooth resumption |
| **Confirm cash in till** matches system | Avoid discrepancies on restart |

### 34.4.2 During Offline Operation

| Practice | Reason |
|---|---|
| **Minimize concurrent edits** to same order/ticket | Reduces sync conflict probability |
| **Avoid long periods offline** (>24h) | Increases sync data volume; conflict risk |
| **Periodically check connection** (every few hours) | Restore network if possible; reduce sync payload |
| **Record wastage/manual adjustments** immediately | Easier to reconcile than batch-long edits |

### 34.4.3 Resuming Online

1. **Network restores** → sync begins automatically
2. **Monitor** "Syncing..." banner until complete
3. **Review** "Sync Summary" (conflicts, data changes)
4. **Run a quick reconciliation** (physical count vs system, cash count vs Z-Report)
5. **Continue operation** as normal

---

## 34.4 Emergency Offline Scenario

**If network is critical down for extended period**:

1. **Shift change** via handover notes (document offline operations)
2. **Physical counts** recorded on paper sheets (backup)
3. **Cash counting** done with two staff members
4. **Manual log** of any compensations/voids not recorded by system
5. **Sync review** when network restores; reconcile all manual records

---

## 34.5 Next Steps

After understanding offline behavior:

1. **Test offline mode**: Disconnect network; make changes; reconnect and observe sync
2. **Read** `14_sync-protocol.md` for CRDT sync mechanics
3. **Read** `25-kds-kitchen-interaction.md` for KDS offline specifics

---
*This file is part of the PlinthOS end user documentation set.*