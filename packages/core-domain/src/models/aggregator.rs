use crate::enums::OrderChannel;
use crate::ids::{AggregatorOrderId, LocationId, TenantId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Represents an inbound order from a 3rd-party food delivery aggregator (Swiggy/Zomato)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AggregatorOrder {
    /// Internal aggregator order identifier
    pub id: AggregatorOrderId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Outlet location identifier
    pub location_id: LocationId,
    /// Platform (Swiggy / Zomato)
    pub platform: OrderChannel,
    /// External order ID from the aggregator platform
    pub external_order_id: String,
    /// Raw webhook JSON payload for audit and reconciliation
    pub raw_payload: String,
    /// Platform commission rate
    pub commission_rate: Decimal,
    /// Assigned delivery rider name
    pub rider_name: Option<String>,
    /// Order timestamp from platform
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use crate::enums::OrderChannel;
    use crate::ids::{AggregatorOrderId, LocationId, TenantId};
    use crate::models::aggregator::AggregatorOrder;
    use chrono::Utc;
    use rust_decimal::Decimal;

    #[test]
    fn test_aggregator_order() {
        let order = AggregatorOrder {
            id: AggregatorOrderId::new(),
            tenant_id: TenantId::new(),
            location_id: LocationId::new(),
            platform: OrderChannel::Swiggy,
            external_order_id: "SWIG-12345".to_string(),
            raw_payload: "{}".to_string(),
            commission_rate: Decimal::new(18, 2),
            rider_name: Some("Ramesh".to_string()),
            created_at: Utc::now(),
        };
        assert_eq!(order.platform, OrderChannel::Swiggy);
    }
}
