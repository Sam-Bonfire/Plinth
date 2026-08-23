use crate::enums::order_status::OrderStatus;
use crate::events::order::OrderEvent;
use crate::ids::{OrderId, StaffMemberId, TerminalId};
use crate::models::aggregator::AggregatorOrder;
use crate::models::order::{Order, OrderLineItem};
use chrono::Utc;

/// Service for converting aggregator orders into internal orders.
#[derive(Debug, Clone)]
pub struct AggregatorConversionService;

impl AggregatorConversionService {
    /// Converts an aggregator order into a system order and an initial event.
    #[must_use]
    pub fn convert_aggregator_order(
        aggregator_order: &AggregatorOrder,
        items: Vec<OrderLineItem>,
        system_staff_id: StaffMemberId,
        terminal_id: TerminalId,
    ) -> (Order, OrderEvent) {
        let order_id = OrderId::new();
        let now = Utc::now();
        
        let order = Order {
            id: order_id,
            tenant_id: aggregator_order.tenant_id,
            location_id: aggregator_order.location_id,
            channel: aggregator_order.platform,
            status: OrderStatus::Confirmed,
            terminal_id,
            table_id: None,
            seat_number: None,
            items,
            discounts: Vec::new(),
            charges: Vec::new(),
            tip: None,
            payments: Vec::new(),
            split_from: None,
            created_by: system_staff_id,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };

        let event = OrderEvent::Created {
            order_id,
            tenant_id: order.tenant_id,
            location_id: order.location_id,
            terminal_id: order.terminal_id,
            channel: order.channel,
            created_by: order.created_by,
            created_at: now,
        };

        (order, event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::OrderChannel;
    use crate::ids::{
        AggregatorOrderId, LocationId, MenuItemId, OrderLineItemId, TenantId
    };
    use crate::value_objects::money::{Currency, Money};
    use crate::value_objects::tax::GstRate;
    use rust_decimal::Decimal;

    #[test]
    fn test_aggregator_order_conversion() {
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let system_staff_id = StaffMemberId::new();

        let agg_order = AggregatorOrder {
            id: AggregatorOrderId::new(),
            tenant_id,
            location_id,
            platform: OrderChannel::Swiggy,
            external_order_id: "SWIGGY-98765".to_string(),
            raw_payload: r#"{"order_id": "SWIGGY-98765"}"#.to_string(),
            commission_rate: Decimal::new(18, 2),
            rider_name: Some("Rahul Kumar".to_string()),
            created_at: Utc::now(),
        };

        let items = vec![OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: MenuItemId::new(),
            name: "Biryani".to_string(),
            base_price: Money { amount: Decimal::new(300, 0), currency: Currency::Inr },
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money { amount: Decimal::new(300, 0), currency: Currency::Inr },
            quantity: 1,
            fired_quantity: 0,
            tax_rate: GstRate::FivePercent,
            notes: None,
            seat_number: None,
        }];

        let (order, event) = AggregatorConversionService::convert_aggregator_order(
            &agg_order,
            items,
            system_staff_id,
            terminal_id,
        );

        assert_eq!(order.channel, OrderChannel::Swiggy);
        assert_eq!(order.status, OrderStatus::Confirmed);
        assert_eq!(order.items.len(), 1);
        assert_eq!(event.order_id(), order.id);
    }
}
