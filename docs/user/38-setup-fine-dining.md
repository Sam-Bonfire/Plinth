# 38-setup-fine-dining.md - Fine Dining Restaurant Setup Configuration

**Author**: PlinthOS Documentation Team  
**Version**: 0.1.0  
**Last Reviewed**: 2026-08-28  
**Related Files**: 
- `21_pos-quick-start.md` (POS baseline)
- `25-kds-kitchen-interaction.md` (KDS workflow)
- `27_menu-management.md` (menu configuration)
- `35-best-practices-operations.md` (opening/closing procedures)

---

## 38.1 Fine Dining-Optimized Configuration

### 38.1.1 KDS Settings for Fine Dining

| Setting | Fine Dining Recommendation | Reason |
|---|---|---|
| **SLA Green threshold** | < 8 minutes | Fine dining has more complex prep; guests expect quality over speed |
| **SLA Yellow threshold** | 8 - 12 minutes | Allows kitchen to maintain quality pace |
| **SLA Red threshold** | > 15 minutes | Triggers manager intervention; comp item consideration |
| **Course stages** | Enabled (APPETIZER → MAIN → DESSERT → DRINKS) | Multi-course meal workflow |
| **Station assignment** | Weighted by chef expertise | Experienced chefs on grill/main; juniors on appetizers/dessert |
| **Fast-track bump** | Enabled for supervisors only | Quality control; only authorized roles bypass state machine |

### 38.1.2 Menu Configuration for Fine Dining

| Feature | Fine Dining Setup |
|---|---|
| **Modifier groups** | Extensive: allergies, cooking temperature, wine pairings, dietary labels |
| **Photo upload** | Required (visual presentation is key to marketing) |
| **Price scheduling** | Common (seasonal menus, weekly specials, holiday pricing) |
| **86 workflow** | Critical for seasonal item removal; also for "off-menu" requests |
| **Course stages** | Mandatory; tracks progression through meal |

### 38.1.3 POS Workflow Optimizations

| Optimization | Configuration |
|---|---|
| **Default quantity** | 1; but server can adjust for table size |
| **Split by seat** | Highly recommended (large tables, shared dishes) |
| **Payment types** | Card dominant; split billing essential for tables |
| **Tip prompting** | 15%, 18%, 20% as default percentages |
| **Item search** | Enabled; filter by course stage |

### 38.1.4 Inventory for Fine Dining

| Item Type | Tracking Frequency | Reorder Logic |
|---|---|---|
| **Wine cellar** | Weekly count; temperature logged | Expensive; high `maximum_stock`, low `reorder_point` |
| **Specialty ingredients** (truffles, caviar) | Per-delivery arrival | Low volume; keep safety stock |
| **Produce** (herbs, microgreens) | Every 2-3 days | Quick turnover; `reorder_point` set for 3-day supply |
| **Aging meats** | Track by dry-aging day count | Expensive; meticulous tracking |

### 38.1.3.1 Example: Fine Dining Steakhouse

- **Stock items**: Filet mignon (20 orders/day), asparagus (50 orders/week), wine (30 bottles)
- **reorder_point**: 10 bottles wine, 15 asparagus bundles
- **maximum_stock**: 50 bottles wine, 30 asparagus bundles
- **wastage tracking**: Enabled; typical wastage = small portions, trim

---

## 38.2 Fine Dining Opening/Closing Checklist

### 38.1.1 Opening

- [ ] Tap "Open Shift"
- [ ] Set table maps; place cards; review reservations
- [ ] Verify wine cellar stock and temperature
- [ ] Review course-stage configuration for the evening
- [ ] Confirm 86'd items; restore any seasonal items planned for tonight
- [ ] Brief floor staff on VIPs, special requests, large parties

### 38.1.2 Closing

- [ ] Settle all open checks
- [ ] Final wine inventory count (bottles remaining)
- [ ] Tap "Close Shift" → generate Z-Report
- [ ] Document any comp'd items and raisons
- [ ] Archive wine sales data for cellar management
- [ ] Brief night crew on next-day specials

---

## 38.2 Fine Dining Best Practices

- **Course progression**: Ensure kitchen follows APPETIZER → MAIN → DESSERT → DRINKS; do not rush stages
- **Wine pairing**: KDS notes should include wine pairing suggestions for each course
- **Modifier detail**: Cooking temperature (rare, medium-rare, medium, well-done) is a modifier; must be captured
- **SLA tolerance**: Fine dining SLA is about quality, not speed; Red alert should trigger "check on guest" not "comp item"
- **Tip pooling**: Typically higher in fine dining; ensure distribution formula is clearly communicated to staff

---
*This file is part of the PlinthOS end user documentation set.*