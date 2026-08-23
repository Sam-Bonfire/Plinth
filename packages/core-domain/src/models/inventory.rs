use crate::events::stock::{StockAdjustmentReason, StockEvent};
use crate::ids::{LocationId, MenuItemId, RecipeId, StaffMemberId, StockItemId, TenantId};
use crate::value_objects::measurement::{StockQuantity, UnitOfMeasure};
use crate::value_objects::money::{Currency, Money};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Error type for inventory operations.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum InventoryError {
    /// Error when a stock item is missing from costs.
    #[error("Missing stock item cost for stock item: {0:?}")]
    MissingStockItemCost(StockItemId),
}

/// Represents a stock item in inventory.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StockItem {
    /// Unique identifier for the stock item.
    pub id: StockItemId,
    /// Tenant this stock item belongs to.
    pub tenant_id: TenantId,
    /// Location this stock item belongs to.
    pub location_id: LocationId,
    /// Name of the stock item.
    pub name: String,
    /// Unit of measure for the stock item.
    pub unit: UnitOfMeasure,
    /// Current quantity in stock.
    pub current_quantity: StockQuantity,
    /// Par level for the stock item.
    pub par_level: StockQuantity,
    /// Reorder level for the stock item.
    pub reorder_level: StockQuantity,
    /// Cost per unit of the stock item.
    pub cost_per_unit: Money,
    /// Whether the stock item is active.
    pub is_active: bool,
    /// When the stock item was deleted.
    pub deleted_at: Option<DateTime<Utc>>,
}

impl StockItem {
    /// Creates a new `StockItem`.
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        id: StockItemId,
        tenant_id: TenantId,
        location_id: LocationId,
        name: String,
        unit: UnitOfMeasure,
        current_quantity: StockQuantity,
        par_level: StockQuantity,
        reorder_level: StockQuantity,
        cost_per_unit: Money,
    ) -> Self {
        Self {
            id,
            tenant_id,
            location_id,
            name,
            unit,
            current_quantity,
            par_level,
            reorder_level,
            cost_per_unit,
            is_active: true,
            deleted_at: None,
        }
    }

    /// Adjusts the stock quantity by a delta.
    pub fn adjust_stock(
        &mut self,
        delta: Decimal,
        reason: StockAdjustmentReason,
        adjusted_by: Option<StaffMemberId>,
    ) -> (StockEvent, bool) {
        let previous_qty = self.current_quantity.value;
        self.current_quantity.value += delta;
        
        let is_negative = self.current_quantity.value < Decimal::ZERO;
        
        let event = StockEvent::QuantityAdjusted {
            stock_item_id: self.id,
            reason,
            old_quantity_str: previous_qty.to_string(),
            new_quantity_str: self.current_quantity.value.to_string(),
            adjusted_by,
            adjusted_at: Utc::now(),
        };

        (event, is_negative)
    }

    /// Checks if the current quantity is below the reorder level.
    #[must_use]
    pub fn is_below_reorder(&self) -> bool {
        self.current_quantity.value <= self.reorder_level.value
    }
}

/// Represents an ingredient in a recipe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecipeIngredient {
    /// Stock item identifier.
    pub stock_item_id: StockItemId,
    /// Quantity of the stock item required.
    pub quantity: StockQuantity,
    /// Wastage percentage for this ingredient.
    pub wastage_percent: Decimal,
}

/// Represents a recipe for a menu item.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Recipe {
    /// Unique identifier for the recipe.
    pub id: RecipeId,
    /// Menu item this recipe is for.
    pub menu_item_id: MenuItemId,
    /// Ingredients required for the recipe.
    pub ingredients: Vec<RecipeIngredient>,
    /// Preparation notes.
    pub preparation_notes: Option<String>,
}

impl Recipe {
    /// Computes the theoretical cost of the recipe based on stock costs.
    ///
    /// # Errors
    /// Returns `InventoryError::MissingStockItemCost` if an ingredient's cost is missing.
    pub fn compute_theoretical_cost(&self, stock_costs: &HashMap<StockItemId, Money>) -> Result<Money, InventoryError> {
        let mut total_amount = Decimal::ZERO;
        let mut currency = None;

        for ingredient in &self.ingredients {
            let cost = stock_costs.get(&ingredient.stock_item_id)
                .ok_or(InventoryError::MissingStockItemCost(ingredient.stock_item_id))?;
            
            if currency.is_none() {
                currency = Some(cost.currency);
            }

            let wastage_multiplier = Decimal::ONE + (ingredient.wastage_percent / Decimal::new(100, 0));
            let amount = cost.amount * ingredient.quantity.value * wastage_multiplier;
            total_amount += amount;
        }

        let default_currency = currency.unwrap_or(Currency::Inr);
        
        Ok(Money {
            amount: total_amount,
            currency: default_currency,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::events::stock::StockAdjustmentReason;
    use crate::ids::{LocationId, MenuItemId, RecipeId, StockItemId, TenantId};
    use crate::models::inventory::{Recipe, RecipeIngredient, StockItem};
    use crate::value_objects::measurement::{StockQuantity, UnitOfMeasure};
    use crate::value_objects::money::{Currency, Money};
    use rust_decimal::Decimal;
    use std::collections::HashMap;

    #[test]
    fn test_stock_item_adjustment_and_reorder() {
        let mut item = StockItem::new(
            StockItemId::new(),
            TenantId::new(),
            LocationId::new(),
            "Mozzarella Cheese".to_string(),
            UnitOfMeasure::Kilogram,
            StockQuantity { value: Decimal::new(10, 0), unit: UnitOfMeasure::Kilogram },
            StockQuantity { value: Decimal::new(20, 0), unit: UnitOfMeasure::Kilogram },
            StockQuantity { value: Decimal::new(5, 0), unit: UnitOfMeasure::Kilogram },
            Money { amount: Decimal::new(500, 0), currency: Currency::Inr },
        );

        assert!(!item.is_below_reorder());

        // Deduct 7 kg -> leaves 3 kg (<= 5 kg reorder level)
        let (evt, is_neg) = item.adjust_stock(
            Decimal::new(-7, 0),
            StockAdjustmentReason::OrderDeduction,
            None,
        );
        assert!(!is_neg);
        assert!(item.is_below_reorder());
        assert_eq!(evt.stock_item_id(), item.id);

        // Deduct 5 kg -> leaves -2 kg (negative stock tolerance allowed with warning)
        let (_, is_neg) = item.adjust_stock(
            Decimal::new(-5, 0),
            StockAdjustmentReason::OrderDeduction,
            None,
        );
        assert!(is_neg);
        assert_eq!(item.current_quantity.value, Decimal::new(-2, 0));
    }

    #[test]
    fn test_recipe_theoretical_costing() {
        let stock1 = StockItemId::new();
        let stock2 = StockItemId::new();

        let recipe = Recipe {
            id: RecipeId::new(),
            menu_item_id: MenuItemId::new(),
            ingredients: vec![
                RecipeIngredient {
                    stock_item_id: stock1,
                    quantity: StockQuantity { value: Decimal::new(2, 1), unit: UnitOfMeasure::Kilogram }, // 0.2 kg
                    wastage_percent: Decimal::ZERO,
                },
                RecipeIngredient {
                    stock_item_id: stock2,
                    quantity: StockQuantity { value: Decimal::new(1, 1), unit: UnitOfMeasure::Kilogram }, // 0.1 kg
                    wastage_percent: Decimal::new(10, 0), // 10% wastage = 0.11 kg
                },
            ],
            preparation_notes: None,
        };

        let mut costs = HashMap::new();
        costs.insert(stock1, Money { amount: Decimal::new(500, 0), currency: Currency::Inr }); // 0.2 * 500 = 100
        costs.insert(stock2, Money { amount: Decimal::new(200, 0), currency: Currency::Inr }); // 0.11 * 200 = 22

        let total_cost = recipe.compute_theoretical_cost(&costs).unwrap();
        // Total = 100 + 22 = 122 INR
        assert_eq!(total_cost.amount, Decimal::new(122, 0));
    }
}
