use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        pub struct $name(Uuid);

        impl $name {
            /// Generates a new unique identifier using UUID v7.
            #[allow(clippy::new_without_default)]
            pub fn new() -> Self {
                Self(Uuid::now_v7())
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl From<Uuid> for $name {
            fn from(uuid: Uuid) -> Self {
                Self(uuid)
            }
        }

        impl From<$name> for Uuid {
            fn from(id: $name) -> Self {
                id.0
            }
        }
    };
}

define_id!(
    /// Identifier for a Tenant (Restaurant group/brand)
    TenantId
);
define_id!(
    /// Identifier for a Location (Specific outlet/branch)
    LocationId
);
define_id!(
    /// Identifier for a Terminal (POS register/device)
    TerminalId
);
define_id!(
    /// Identifier for an Order
    OrderId
);
define_id!(
    /// Identifier for an Order Line Item
    OrderLineItemId
);
define_id!(
    /// Identifier for a Kitchen Ticket
    KitchenTicketId
);
define_id!(
    /// Identifier for a Stock Item
    StockItemId
);
define_id!(
    /// Identifier for a Menu Item
    MenuItemId
);
define_id!(
    /// Identifier for a Menu Category
    MenuCategoryId
);
define_id!(
    /// Identifier for a Staff Member
    StaffMemberId
);
define_id!(
    /// Identifier for a Floor Table
    FloorTableId
);
define_id!(
    /// Identifier for a Reservation
    ReservationId
);
define_id!(
    /// Identifier for a Shift
    ShiftId
);
define_id!(
    /// Identifier for a Refund
    RefundId
);
define_id!(
    /// Identifier for an Aggregator Order
    AggregatorOrderId
);
define_id!(
    /// Identifier for a Recipe
    RecipeId
);
define_id!(
    /// Identifier for an Audit Event
    AuditEventId
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id_generation() {
        let id1 = TenantId::new();
        let id2 = TenantId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_display() {
        let id = LocationId::new();
        let s = id.to_string();
        assert_eq!(s.len(), 36);
    }

    #[test]
    fn test_serde() {
        let id = OrderId::new();
        let serialized = serde_json::to_string(&id).unwrap();
        let deserialized: OrderId = serde_json::from_str(&serialized).unwrap();
        assert_eq!(id, deserialized);
    }
}
