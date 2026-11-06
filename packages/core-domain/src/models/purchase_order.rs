use crate::ids::{LocationId, PurchaseOrderId, StockItemId, TenantId, VendorId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum PurchaseOrderStatus {
    Draft,
    Submitted,
    Received,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct PoLineItem {
    pub id: String,
    pub po_id: PurchaseOrderId,
    pub stock_item_id: StockItemId,
    pub quantity: rust_decimal::Decimal,
    pub unit_cost_minor: i64,
    pub total_minor: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct PurchaseOrder {
    pub id: PurchaseOrderId,
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub supplier_name: String,
    pub vendor_id: Option<VendorId>,
    pub status: PurchaseOrderStatus,
    pub total_minor: i64,
    pub created_by: String,
    pub lines: Vec<PoLineItem>,
    pub created_at: DateTime<Utc>,
    pub received_at: Option<DateTime<Utc>>,
}
