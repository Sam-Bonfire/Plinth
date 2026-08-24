use rust_decimal::Decimal;
use std::str::FromStr;

use crate::enums::{KitchenTicketStatus, OrderChannel, OrderStatus};
use crate::ids::{
    KitchenTicketId, LocationId, MenuCategoryId, MenuItemId, OrderId, OrderLineItemId, RecipeId, StaffMemberId, StockItemId, TenantId, TerminalId
};
use crate::models::{
    KitchenTicket, KitchenTicketItem, MenuCategory, MenuItem, Order, OrderLineItem, Recipe, StockItem, StoreShift
};
use crate::value_objects::measurement::{StockQuantity, UnitOfMeasure};
use crate::value_objects::money::{Currency, Money};
use crate::value_objects::tax::{GstApplicability, GstRate, compute_gst};

#[must_use]
pub fn sample_tenant_location() -> (TenantId, LocationId, TerminalId, StaffMemberId) {
    (
        TenantId::new(),
        LocationId::new(),
        TerminalId::new(),
        StaffMemberId::new(),
    )
}

/// # Panics
/// Panics if valid money string parsing fails
#[must_use]
pub fn sample_catalog() -> (Vec<MenuCategory>, Vec<MenuItem>) {
    let cat_starters = MenuCategory { id: MenuCategoryId::new(), name: "Starters".to_string() };
    let cat_main = MenuCategory { id: MenuCategoryId::new(), name: "Main Course".to_string() };

    let mi_butter_chicken = MenuItem {
        id: MenuItemId::new(),
        name: "Butter Chicken".to_string(),
        price: Money { amount: Decimal::from_str("320").unwrap(), currency: Currency::Inr },
        gst_rate: GstRate::FivePercent.rate_decimal(),
        is_veg: false,
    };

    let mi_paneer_tikka = MenuItem {
        id: MenuItemId::new(),
        name: "Paneer Tikka Masala".to_string(),
        price: Money { amount: Decimal::from_str("280").unwrap(), currency: Currency::Inr },
        gst_rate: GstRate::FivePercent.rate_decimal(),
        is_veg: true,
    };

    (
        vec![cat_starters, cat_main],
        vec![mi_butter_chicken, mi_paneer_tikka],
    )
}

#[must_use]
pub fn sample_active_order() -> Order {
    let (tenant, location, terminal, staff) = sample_tenant_location();
    let (_, items) = sample_catalog();

    let butter_chicken = &items[0];
    let price = butter_chicken.price.clone();
    let quantity = 2;

    let item_total = price.mul_quantity(quantity);
    let taxes = compute_gst(&item_total, &GstRate::FivePercent, &GstApplicability::IntraState);

    let line_item = OrderLineItem {
        id: OrderLineItemId::new(),
        menu_item_id: butter_chicken.id,
        name: butter_chicken.name.clone(),
        quantity,
        price,
        taxes: taxes.clone(),
    };

    let mut total = item_total.clone();
    if let Ok(sum) = total.add(&taxes.total_tax) {
        total = sum;
    }

    Order {
        id: OrderId::new(),
        tenant_id: tenant,
        location_id: location,
        terminal_id: terminal,
        channel: OrderChannel::DineIn,
        status: OrderStatus::Confirmed,
        items: vec![line_item.clone()],
        subtotal: item_total,
        taxes,
        total,
        payment_method: None,
        created_by: staff,
    }
}

#[must_use]
pub fn sample_kitchen_tickets() -> Vec<KitchenTicket> {
    let order = sample_active_order();

    let ticket = KitchenTicket {
        id: KitchenTicketId::new(),
        order_id: order.id,
        location_id: order.location_id,
        kot_number: 1,
        status: KitchenTicketStatus::InPrep,
        items: vec![
            KitchenTicketItem { name: "Butter Chicken".to_string() }
        ],
    };

    vec![ticket]
}

/// # Panics
/// Panics if valid quantity or money string parsing fails
#[must_use]
pub fn sample_inventory_items() -> (Vec<StockItem>, Vec<Recipe>) {
    let loc = LocationId::new();
    let mi_id = MenuItemId::new();

    let chicken_stock = StockItem {
        id: StockItemId::new(),
        location_id: loc,
        name: "Chicken".to_string(),
        quantity: StockQuantity::new(Decimal::from_str("10").unwrap(), UnitOfMeasure::Kilogram).unwrap(),
    };

    let butter_chicken_recipe = Recipe {
        id: RecipeId::new(),
        menu_item_id: mi_id,
        instructions: "Chicken 250g · Butter 30g · Cream 40ml · Tomato 80g · Spices".to_string(),
        cost: Money { amount: Decimal::from_str("98").unwrap(), currency: Currency::Inr },
    };

    (vec![chicken_stock], vec![butter_chicken_recipe])
}

/// # Panics
/// Panics if valid money string parsing fails
#[must_use]
pub fn sample_store_shift() -> StoreShift {
    let (tenant, location, _, _) = sample_tenant_location();

    StoreShift {
        tenant_id: tenant,
        location_id: location,
        float_amount: Money { amount: Decimal::from_str("5000").unwrap(), currency: Currency::Inr },
        cash_sales: Money { amount: Decimal::from_str("18420").unwrap(), currency: Currency::Inr },
        upi_sales: Money { amount: Decimal::from_str("42950").unwrap(), currency: Currency::Inr },
        card_sales: Money { amount: Decimal::from_str("31200").unwrap(), currency: Currency::Inr },
        expected_till_amount: Money { amount: Decimal::from_str("23420").unwrap(), currency: Currency::Inr },
    }
}
