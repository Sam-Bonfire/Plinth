use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::enums::{OrderChannel, OrderStatus, PaymentMethod};
use crate::ids::{LocationId, MenuItemId, OrderId, OrderLineItemId, StaffMemberId, TenantId, TerminalId};

/// Domain events emitted by the Order aggregate.
/// Each event is a self-contained record of a state change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderEvent {
    /// Event when an order is created
    Created {
        /// Order ID
        order_id: OrderId,
        /// Tenant ID
        tenant_id: TenantId,
        /// Location ID
        location_id: LocationId,
        /// Terminal ID
        terminal_id: TerminalId,
        /// Order channel
        channel: OrderChannel,
        /// Staff member who created the order
        created_by: StaffMemberId,
        /// Timestamp
        created_at: DateTime<Utc>,
    },
    /// Event when an item is added
    ItemAdded {
        /// Order ID
        order_id: OrderId,
        /// Line item ID
        line_item_id: OrderLineItemId,
        /// Menu item ID
        menu_item_id: MenuItemId,
        /// Item name
        item_name: String,
        /// Quantity
        quantity: u32,
        /// Unit price in minor units
        unit_price_minor: i64,
        /// Modifier total in minor units
        modifier_total_minor: i64,
        /// Timestamp
        added_at: DateTime<Utc>,
    },
    /// Event when an item is removed
    ItemRemoved {
        /// Order ID
        order_id: OrderId,
        /// Line item ID
        line_item_id: OrderLineItemId,
        /// Reason for removal
        reason: Option<String>,
        /// Timestamp
        removed_at: DateTime<Utc>,
    },
    /// Event when an item's quantity changes
    ItemQuantityChanged {
        /// Order ID
        order_id: OrderId,
        /// Line item ID
        line_item_id: OrderLineItemId,
        /// Old quantity
        old_quantity: u32,
        /// New quantity
        new_quantity: u32,
        /// Timestamp
        changed_at: DateTime<Utc>,
    },
    /// Event when a discount is applied
    DiscountApplied {
        /// Order ID
        order_id: OrderId,
        /// Discount percentage as string
        discount_percentage: Option<String>,
        /// Discount flat amount in minor units
        discount_flat_minor: Option<i64>,
        /// Reason
        reason: String,
        /// Staff member who authorized
        authorized_by: Option<StaffMemberId>,
        /// Timestamp
        applied_at: DateTime<Utc>,
    },
    /// Event when a discount is removed
    DiscountRemoved {
        /// Order ID
        order_id: OrderId,
        /// Timestamp
        removed_at: DateTime<Utc>,
    },
    /// Event when a charge is added
    ChargeAdded {
        /// Order ID
        order_id: OrderId,
        /// Charge type
        charge_type: String,
        /// Amount in minor units
        amount_minor: i64,
        /// Whether it's taxable
        taxable: bool,
        /// Timestamp
        added_at: DateTime<Utc>,
    },
    /// Event when a payment is recorded
    PaymentRecorded {
        /// Order ID
        order_id: OrderId,
        /// Payment method
        method: PaymentMethod,
        /// Amount in minor units
        amount_minor: i64,
        /// Reference
        reference: Option<String>,
        /// Timestamp
        recorded_at: DateTime<Utc>,
    },
    /// Event when a tip is added
    TipAdded {
        /// Order ID
        order_id: OrderId,
        /// Amount in minor units
        amount_minor: i64,
        /// Recipient
        recipient: Option<StaffMemberId>,
        /// Timestamp
        added_at: DateTime<Utc>,
    },
    /// Event when status changes
    StatusChanged {
        /// Order ID
        order_id: OrderId,
        /// Previous status
        from: OrderStatus,
        /// New status
        to: OrderStatus,
        /// Changed by
        changed_by: Option<StaffMemberId>,
        /// Timestamp
        changed_at: DateTime<Utc>,
    },
    /// Event when a bill is split
    BillSplit {
        /// Parent order ID
        parent_order_id: OrderId,
        /// Child order IDs
        child_order_ids: Vec<OrderId>,
        /// Timestamp
        split_at: DateTime<Utc>,
    },
    /// Event when an order is voided
    Voided {
        /// Order ID
        order_id: OrderId,
        /// Reason
        reason: String,
        /// Voided by
        voided_by: StaffMemberId,
        /// Requires supervisor
        requires_supervisor: bool,
        /// Timestamp
        voided_at: DateTime<Utc>,
    },
    /// Event when an order is settled
    Settled {
        /// Order ID
        order_id: OrderId,
        /// Total in minor units
        total_minor: i64,
        /// Timestamp
        settled_at: DateTime<Utc>,
    },
}

impl OrderEvent {
    /// Get the order ID associated with this event
    #[must_use]
    pub fn order_id(&self) -> OrderId {
        match self {
            Self::BillSplit { parent_order_id, .. } => *parent_order_id,
            Self::Created { order_id, .. }
            | Self::ItemAdded { order_id, .. }
            | Self::ItemRemoved { order_id, .. }
            | Self::ItemQuantityChanged { order_id, .. }
            | Self::DiscountApplied { order_id, .. }
            | Self::DiscountRemoved { order_id, .. }
            | Self::ChargeAdded { order_id, .. }
            | Self::PaymentRecorded { order_id, .. }
            | Self::TipAdded { order_id, .. }
            | Self::StatusChanged { order_id, .. }
            | Self::Voided { order_id, .. }
            | Self::Settled { order_id, .. } => *order_id,
        }
    }

    /// Get the timestamp when this event occurred
    #[must_use]
    pub fn occurred_at(&self) -> DateTime<Utc> {
        match self {
            Self::Created { created_at, .. } => *created_at,
            Self::ItemAdded { added_at, .. }
            | Self::ChargeAdded { added_at, .. }
            | Self::TipAdded { added_at, .. } => *added_at,
            Self::ItemRemoved { removed_at, .. }
            | Self::DiscountRemoved { removed_at, .. } => *removed_at,
            Self::ItemQuantityChanged { changed_at, .. }
            | Self::StatusChanged { changed_at, .. } => *changed_at,
            Self::DiscountApplied { applied_at, .. } => *applied_at,
            Self::PaymentRecorded { recorded_at, .. } => *recorded_at,
            Self::BillSplit { split_at, .. } => *split_at,
            Self::Voided { voided_at, .. } => *voided_at,
            Self::Settled { settled_at, .. } => *settled_at,
        }
    }

    /// Get the event type as a string
    #[must_use]
    pub fn event_type(&self) -> &'static str {
        match self {
            Self::Created { .. } => "Created",
            Self::ItemAdded { .. } => "ItemAdded",
            Self::ItemRemoved { .. } => "ItemRemoved",
            Self::ItemQuantityChanged { .. } => "ItemQuantityChanged",
            Self::DiscountApplied { .. } => "DiscountApplied",
            Self::DiscountRemoved { .. } => "DiscountRemoved",
            Self::ChargeAdded { .. } => "ChargeAdded",
            Self::PaymentRecorded { .. } => "PaymentRecorded",
            Self::TipAdded { .. } => "TipAdded",
            Self::StatusChanged { .. } => "StatusChanged",
            Self::BillSplit { .. } => "BillSplit",
            Self::Voided { .. } => "Voided",
            Self::Settled { .. } => "Settled",
        }
    }
}
