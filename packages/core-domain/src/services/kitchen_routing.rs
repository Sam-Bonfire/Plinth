use crate::enums::kitchen::{KitchenTicketStatus, StationId};
use crate::ids::{KitchenTicketId, MenuItemId};
use crate::models::catalog::MenuItem;
use crate::models::kitchen::{KitchenTicket, TicketLineItem};
use crate::models::order::Order;
use crate::value_objects::preparation::PreparationSla;
use chrono::Utc;
use std::collections::HashMap;

/// Service for routing orders to kitchen stations.
#[derive(Debug, Clone)]
pub struct KitchenRoutingService;

impl KitchenRoutingService {
    /// Routes an order to kitchen stations by generating tickets.
    #[must_use]
    pub fn route_order(
        order: &Order,
        catalog: &HashMap<MenuItemId, MenuItem>,
        starting_kot_number: u32,
    ) -> Vec<KitchenTicket> {
        let mut grouped_items: HashMap<StationId, Vec<_>> = HashMap::new();

        for item in &order.items {
            if item.quantity > item.fired_quantity {
                if let Some(menu_item) = catalog.get(&item.menu_item_id) {
                    grouped_items.entry(menu_item.kitchen_station.clone())
                        .or_default()
                        .push(item.clone());
                }
            }
        }

        let mut tickets = Vec::new();

        for (current_kot, (station_id, items)) in (starting_kot_number..).zip(grouped_items) {
            let now = Utc::now();
            let ticket = KitchenTicket {
                id: KitchenTicketId::new(),
                tenant_id: order.tenant_id,
                location_id: order.location_id,
                order_id: order.id,
                station: station_id,
                kot_number: current_kot,
                items: items.into_iter().map(|item| TicketLineItem {
                    line_item_id: item.id,
                    menu_item_id: item.menu_item_id,
                    name: item.name.clone(),
                    quantity: item.quantity,
                    modifiers: item.modifier_selections.clone(),
                    special_instructions: item.notes.clone(),
                }).collect(),
                status: KitchenTicketStatus::Pending,
                sla: PreparationSla::default_restaurant(),
                created_at: now,
                bumped_at: None,
                bumped_by: None,
                cancelled_at: None,
                cancellation_reason: None,
            };
            tickets.push(ticket);
        }

        tickets
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::OrderChannel;
    use crate::ids::{LocationId, MenuCategoryId, MenuItemId, OrderLineItemId, StaffMemberId, TenantId, TerminalId};
    use crate::models::order::OrderLineItem;
    use crate::value_objects::money::{Currency, Money};
    use crate::value_objects::pricing::PricingVersion;
    use crate::value_objects::tax::GstRate;
    use rust_decimal::Decimal;

    #[test]
    fn test_kitchen_routing_multi_station_and_delta() {
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();

        let (mut order, _) = Order::new(
            tenant_id,
            location_id,
            terminal_id,
            OrderChannel::DineIn,
            staff_id,
            None,
            None,
        );

        let item1_id = MenuItemId::new();
        let item2_id = MenuItemId::new();

        let pricing = PricingVersion {
            price: Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            effective_from: Utc::now() - chrono::Duration::hours(1),
            effective_until: None,
        };

        let mut catalog = HashMap::new();
        catalog.insert(
            item1_id,
            MenuItem::new(
                item1_id,
                tenant_id,
                location_id,
                MenuCategoryId::new(),
                "Paneer Tikka".to_string(),
                pricing.clone(),
                GstRate::FivePercent,
                true,
                StationId::Tandoor,
            ),
        );
        catalog.insert(
            item2_id,
            MenuItem::new(
                item2_id,
                tenant_id,
                location_id,
                MenuCategoryId::new(),
                "Cold Coffee".to_string(),
                pricing,
                GstRate::TwelvePercent,
                true,
                StationId::Beverages,
            ),
        );

        let line1 = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: item1_id,
            name: "Paneer Tikka".to_string(),
            base_price: Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            quantity: 2,
            fired_quantity: 0,
            tax_rate: GstRate::FivePercent,
            notes: Some("Extra crispy".to_string()),
            seat_number: None,
        };

        let line2 = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: item2_id,
            name: "Cold Coffee".to_string(),
            base_price: Money { amount: Decimal::new(150, 0), currency: Currency::Inr },
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money { amount: Decimal::new(150, 0), currency: Currency::Inr },
            quantity: 1,
            fired_quantity: 0,
            tax_rate: GstRate::TwelvePercent,
            notes: None,
            seat_number: None,
        };

        order.add_item(line1).unwrap();
        order.add_item(line2).unwrap();

        // Route order
        let tickets = KitchenRoutingService::route_order(&order, &catalog, 101);
        assert_eq!(tickets.len(), 2);
        assert!(tickets.iter().any(|t| t.station == StationId::Tandoor));
        assert!(tickets.iter().any(|t| t.station == StationId::Beverages));

        // Mark items fired
        order.mark_all_fired();
        let second_routing = KitchenRoutingService::route_order(&order, &catalog, 103);
        assert_eq!(second_routing.len(), 0);
    }
}
