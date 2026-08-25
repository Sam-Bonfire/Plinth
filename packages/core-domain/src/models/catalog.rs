use crate::enums::kitchen::StationId;
use crate::ids::{LocationId, MenuCategoryId, MenuItemId, TenantId};
use crate::value_objects::modifier::ModifierGroup;
use crate::value_objects::money::Money;
use crate::value_objects::pricing::PricingVersion;
use crate::value_objects::tax::GstRate;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Represents a category for grouping menu items.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MenuCategory {
    /// Unique identifier for the category.
    pub id: MenuCategoryId,
    /// Tenant this category belongs to.
    pub tenant_id: TenantId,
    /// Location this category belongs to.
    pub location_id: LocationId,
    /// Name of the category.
    pub name: String,
    /// Order for display purposes.
    pub display_order: u16,
    /// Whether the category is active.
    pub is_active: bool,
    /// When the category was deleted.
    pub deleted_at: Option<DateTime<Utc>>,
}

impl MenuCategory {
    /// Creates a new `MenuCategory`.
    #[must_use]
    pub fn new(id: MenuCategoryId, tenant_id: TenantId, location_id: LocationId, name: String, display_order: u16) -> Self {
        Self {
            id,
            tenant_id,
            location_id,
            name,
            display_order,
            is_active: true,
            deleted_at: None,
        }
    }
}

/// Represents an item on the menu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MenuItem {
    /// Unique identifier for the menu item.
    pub id: MenuItemId,
    /// Tenant this item belongs to.
    pub tenant_id: TenantId,
    /// Location this item belongs to.
    pub location_id: LocationId,
    /// Primary category for the item.
    pub primary_category_id: MenuCategoryId,
    /// Additional category tags.
    pub category_tags: Vec<MenuCategoryId>,
    /// Name of the item.
    pub name: String,
    /// Description of the item.
    pub description: Option<String>,
    /// Pricing details for the item.
    pub pricing: PricingVersion,
    /// Modifier groups associated with the item.
    pub modifier_groups: Vec<ModifierGroup>,
    /// GST rate for the item.
    pub tax_rate: GstRate,
    /// Whether the item is vegetarian.
    pub is_veg: bool,
    /// Whether the item is currently available (86 toggle).
    pub is_available: bool,
    /// SKU of the item.
    pub sku: Option<String>,
    /// Kitchen station where the item is prepared.
    pub kitchen_station: StationId,
    /// When the item was deleted.
    pub deleted_at: Option<DateTime<Utc>>,
}

impl MenuItem {
    /// Creates a new `MenuItem`.
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        id: MenuItemId,
        tenant_id: TenantId,
        location_id: LocationId,
        primary_category_id: MenuCategoryId,
        name: String,
        pricing: PricingVersion,
        tax_rate: GstRate,
        is_veg: bool,
        kitchen_station: StationId,
    ) -> Self {
        Self {
            id,
            tenant_id,
            location_id,
            primary_category_id,
            category_tags: Vec::new(),
            name,
            description: None,
            pricing,
            modifier_groups: Vec::new(),
            tax_rate,
            is_veg,
            is_available: true,
            sku: None,
            kitchen_station,
            deleted_at: None,
        }
    }

    /// Toggles the availability of the item.
    pub fn toggle_availability(&mut self, available: bool) {
        self.is_available = available;
    }

    /// Checks if the item is available at a given time.
    #[must_use]
    pub fn is_available_at(&self, at: DateTime<Utc>) -> bool {
        self.is_available && self.pricing.is_active_at(at)
    }

    /// Gets the current price of the item at a given time.
    #[must_use]
    pub fn current_price(&self, at: DateTime<Utc>) -> Option<Money> {
        if self.pricing.is_active_at(at) {
            Some(self.pricing.price.clone())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::{Currency, Money};
    use rust_decimal::Decimal;

    #[test]
    fn test_menu_category_creation() {
        let cat = MenuCategory::new(
            MenuCategoryId::new(),
            TenantId::new(),
            LocationId::new(),
            "Main Course".to_string(),
            1,
        );
        assert_eq!(cat.name, "Main Course");
        assert!(cat.is_active);
        assert_eq!(cat.display_order, 1);
    }

    #[test]
    fn test_menu_item_availability_and_pricing() {
        let now = Utc::now();
        let pricing = PricingVersion {
            price: Money {
                amount: Decimal::new(250, 0),
                currency: Currency::Inr,
            },
            effective_from: now - chrono::Duration::hours(1),
            effective_until: Some(now + chrono::Duration::hours(24)),
        };

        let mut item = MenuItem::new(
            MenuItemId::new(),
            TenantId::new(),
            LocationId::new(),
            MenuCategoryId::new(),
            "Butter Chicken".to_string(),
            pricing,
            GstRate::FivePercent,
            false,
            StationId::MainKitchen,
        );

        assert!(item.is_available_at(now));
        assert_eq!(
            item.current_price(now).unwrap(),
            Money {
                amount: Decimal::new(250, 0),
                currency: Currency::Inr,
            }
        );

        item.toggle_availability(false);
        assert!(!item.is_available_at(now));
    }
}
