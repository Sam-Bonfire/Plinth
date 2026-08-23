use crate::events::stock::StockAdjustmentReason;
use crate::ids::{MenuItemId, StockItemId};
use crate::models::inventory::Recipe;
use crate::models::order::Order;
use rust_decimal::Decimal;
use std::collections::HashMap;

/// Represents a deduction to be made from inventory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StockDeduction {
    /// Stock item identifier.
    pub stock_item_id: StockItemId,
    /// Quantity to deduct.
    pub quantity_to_deduct: Decimal,
    /// Reason for the deduction.
    pub reason: StockAdjustmentReason,
}

/// Service for calculating inventory deductions for orders.
#[derive(Debug, Clone)]
pub struct InventoryDeductionService;

impl InventoryDeductionService {
    /// Calculates total stock deductions for an order based on recipes.
    #[must_use]
    pub fn calculate_deductions(
        order: &Order,
        recipes: &HashMap<MenuItemId, Recipe>,
    ) -> Vec<StockDeduction> {
        let mut deductions_map: HashMap<StockItemId, Decimal> = HashMap::new();

        for item in &order.items {
            if let Some(recipe) = recipes.get(&item.menu_item_id) {
                for ingredient in &recipe.ingredients {
                    let wastage_multiplier = Decimal::ONE + (ingredient.wastage_percent / Decimal::new(100, 0));
                    let item_quantity = Decimal::from(item.quantity);
                    let amount_to_deduct = ingredient.quantity.value * item_quantity * wastage_multiplier;
                    
                    *deductions_map.entry(ingredient.stock_item_id).or_default() += amount_to_deduct;
                }
            }
        }

        deductions_map.into_iter().map(|(stock_item_id, quantity_to_deduct)| {
            StockDeduction {
                stock_item_id,
                quantity_to_deduct,
                reason: StockAdjustmentReason::OrderDeduction,
            }
        }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::OrderChannel;
    use crate::ids::{LocationId, MenuItemId, OrderLineItemId, RecipeId, StaffMemberId, StockItemId, TenantId, TerminalId};
    use crate::models::inventory::RecipeIngredient;
    use crate::models::order::OrderLineItem;
    use crate::value_objects::measurement::{StockQuantity, UnitOfMeasure};
    use crate::value_objects::money::{Currency, Money};
    use crate::value_objects::tax::GstRate;

    #[test]
    fn test_inventory_deduction_with_wastage() {
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

        let item_id = MenuItemId::new();
        let stock_item_id = StockItemId::new();

        let line_item = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: item_id,
            name: "Pizza Margherita".to_string(),
            base_price: Money { amount: Decimal::new(400, 0), currency: Currency::Inr },
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money { amount: Decimal::new(400, 0), currency: Currency::Inr },
            quantity: 3,
            fired_quantity: 0,
            tax_rate: GstRate::FivePercent,
            notes: None,
            seat_number: None,
        };
        order.add_item(line_item).unwrap();

        let recipe = Recipe {
            id: RecipeId::new(),
            menu_item_id: item_id,
            ingredients: vec![RecipeIngredient {
                stock_item_id,
                quantity: StockQuantity {
                    value: Decimal::new(200, 3), // 0.200 kg cheese
                    unit: UnitOfMeasure::Kilogram,
                },
                wastage_percent: Decimal::new(10, 0), // 10% wastage -> 0.200 * 1.10 = 0.220 kg per pizza
            }],
            preparation_notes: None,
        };

        let mut recipes = HashMap::new();
        recipes.insert(item_id, recipe);

        let deductions = InventoryDeductionService::calculate_deductions(&order, &recipes);
        assert_eq!(deductions.len(), 1);
        assert_eq!(deductions[0].stock_item_id, stock_item_id);
        // 3 pizzas * 0.220 kg = 0.660 kg
        assert_eq!(deductions[0].quantity_to_deduct, Decimal::new(660, 3));
        assert_eq!(deductions[0].reason, StockAdjustmentReason::OrderDeduction);
    }
}
