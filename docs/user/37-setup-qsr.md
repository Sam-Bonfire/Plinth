# 37-setup-qsr.md - Quick Service Restaurant Setup Configuration

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (POS baseline)
- `25-kds-kitchen-interaction.md` (KDS workflow)
- `28-inventory-and-stock.md` (inventory tracking)
- `35-best-practices-operations.md` (opening/closing procedures)

---

## 37.1 QSR-Optimized Configuration

### 37.1.1 KDS Settings for QSR

| Setting | QSR Recommendation | Reason |
|---|---|---|
| **SLA Green threshold** | < 5 minutes | QSR customers expect fast service |
| **SLA Yellow threshold** | 5 - 8 minutes | Balances alert fatigue with reality |
| **SLA Red threshold** | > 10 minutes | Immediate intervention required |
| **Course stages** | Disabled (or simplified) | QSR typically has no multi-course meals |
| **Station assignment** | Round-robin, balanced | High throughput requires even workload distribution |
| **Fast-track bump** | Enabled for all staff | Rush situations require bypassing standard workflow |

### 37.1.2 Menu Configuration for QSR

| Feature | QSR Setup |
|---|---|
| **Modifier groups** | Limited to 1-2 essential modifiers (e.g., "Spice Level", "Size") |
| **Photo upload** | Optional (QSR focuses on speed over visuals) |
| **Price scheduling** | Rarely needed; keep permanent pricing |
| **86 workflow** | Critical for out-of-stock items during peak service |
| **Course stages** | Not applicable; use "item fired" status instead |

### 37.1.3 POS Workflow Optimizations

| Optimization | Configuration |
|---|---|
| **Default quantity** | 1 (quick tap, no numeric entry needed) |
| **Split by seat** | Recommended (most QSR parties sit together) |
| **Payment types** | Cash + Card primary; UPI if region-specific |
| **Tip prompting** | Optional, typically 0-10% |
| **Item search** | Enabled; hotkeys for frequent items |

### 37.1.4 Inventory for QSR

| Item Type | Tracking Frequency | Reorder Logic |
|---|---|---|
| **Core ingredients** (patties, buns, sauces) | Every shift change | `reorder_point` set for 2-shift buffer |
| **Disposables** (napkins, bags) | Weekly count | High volume; keep `maximum_stock` high |
| **Promotional items** | Per-campaign | Time-bound; 86'd after campaign end |

### 37.1.4.1 Example: Burger Joint Setup

- **Stock items**: Beef patties (100/min shift), buns (200/shift), fries oil (10L/shift)
- **reorder_point**: 20 patties (2-shift buffer)
- **maximum_stock**: 200 patties (max storage capacity)
- **wastage tracking**: Enabled; typical wastage = 2 patties/shift (char grilled excess)

---

## 37.2 QSR Opening/Closing Checklist

### 37.1.1 Opening

- [ ] Tap "Open Shift"
- [ ] Verify till float ($50-$200 based on expected volume)
- [ ] Check KDS is online and SLA timers start
- [ ] Verify core items are NOT 86'd
- [ ] Print daily prep sheet (grill temp, fryer time)
- [ ] Review 86'd items from previous shift; restore if needed

### 37.1.2 Closing

- [ ] Settle all open orders
- [ ] Count till cash; compare to Z-Report
- [ ] Tap "Close Shift" → generate Z-Report
- [ ] Note any variances in shift notes
- [ ] Reset till for next day
- [ ] Print Z-Report for owner/manager

---

## 37.2 QSR Best Practices

- **Prep in batches**: Grill 20 patties at a time during slow periods
- **Modifier simplicity**: Limit to 2 choices max to reduce KDS bottlenecks
- **Sync between shifts**: 15-minute overlap between closing/opening shifts for handover
- **Monitor 86 rates**: If > 15% of items are 86'd during a shift, investigate supply chain
- **Fast-track usage**: Reserve for genuine rush scenarios; overuse masks workflow issues

---
*This file is part of the PlinthOS end user documentation set.*