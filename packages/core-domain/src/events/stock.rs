use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::{LocationId, StaffMemberId, StockItemId};
use crate::value_objects::measurement::UnitOfMeasure;

/// Reason for stock adjustment
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockAdjustmentReason {
    /// Purchase received
    PurchaseReceived,
    /// Spoilage or waste
    SpoilageWaste,
    /// Physical count correction
    PhysicalCountCorrection,
    /// Transfer to another outlet
    OutletTransfer,
    /// Deduction from order
    OrderDeduction,
    /// Custom reason
    Custom(String),
}

/// Domain events emitted by the Stock Item aggregate
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockEvent {
    /// Event when a stock item is created
    ItemCreated {
        /// Stock item ID
        stock_item_id: StockItemId,
        /// Location ID
        location_id: LocationId,
        /// Name of the item
        name: String,
        /// Unit of measure
        unit: UnitOfMeasure,
        /// Timestamp
        created_at: DateTime<Utc>,
    },
    /// Event when quantity is adjusted
    QuantityAdjusted {
        /// Stock item ID
        stock_item_id: StockItemId,
        /// Reason for adjustment
        reason: StockAdjustmentReason,
        /// Old quantity as string (Decimal)
        old_quantity_str: String,
        /// New quantity as string (Decimal)
        new_quantity_str: String,
        /// Staff member who adjusted
        adjusted_by: Option<StaffMemberId>,
        /// Timestamp
        adjusted_at: DateTime<Utc>,
    },
    /// Event when reorder is triggered
    ReorderTriggered {
        /// Stock item ID
        stock_item_id: StockItemId,
        /// Current quantity as string
        current_quantity_str: String,
        /// Reorder level as string
        reorder_level_str: String,
        /// Timestamp
        triggered_at: DateTime<Utc>,
    },
}

impl StockEvent {
    /// Get the stock item ID associated with this event
    #[must_use]
    pub fn stock_item_id(&self) -> StockItemId {
        match self {
            Self::ItemCreated { stock_item_id, .. }
            | Self::QuantityAdjusted { stock_item_id, .. }
            | Self::ReorderTriggered { stock_item_id, .. } => *stock_item_id,
        }
    }

    /// Get the timestamp when this event occurred
    #[must_use]
    pub fn occurred_at(&self) -> DateTime<Utc> {
        match self {
            Self::ItemCreated { created_at, .. } => *created_at,
            Self::QuantityAdjusted { adjusted_at, .. } => *adjusted_at,
            Self::ReorderTriggered { triggered_at, .. } => *triggered_at,
        }
    }
}
