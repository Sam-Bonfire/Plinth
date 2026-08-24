use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::enums::{KitchenTicketStatus, OrderChannel, OrderStatus, PaymentMethod};
use crate::ids::{
    KitchenTicketId, LocationId, MenuCategoryId, MenuItemId, OrderId, OrderLineItemId, RecipeId, StaffMemberId, StockItemId, TenantId, TerminalId
};
use crate::value_objects::money::Money;
use crate::value_objects::measurement::StockQuantity;
use crate::value_objects::tax::TaxBreakdown;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MenuCategory {
    pub id: MenuCategoryId,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: MenuItemId,
    pub name: String,
    pub price: Money,
    pub gst_rate: Decimal,
    pub is_veg: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrderLineItem {
    pub id: OrderLineItemId,
    pub menu_item_id: MenuItemId,
    pub name: String,
    pub quantity: u32,
    pub price: Money,
    pub taxes: TaxBreakdown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub terminal_id: TerminalId,
    pub channel: OrderChannel,
    pub status: OrderStatus,
    pub items: Vec<OrderLineItem>,
    pub subtotal: Money,
    pub taxes: TaxBreakdown,
    pub total: Money,
    pub payment_method: Option<PaymentMethod>,
    pub created_by: StaffMemberId,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KitchenTicketItem {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KitchenTicket {
    pub id: KitchenTicketId,
    pub order_id: OrderId,
    pub location_id: LocationId,
    pub kot_number: u32,
    pub status: KitchenTicketStatus,
    pub items: Vec<KitchenTicketItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StockItem {
    pub id: StockItemId,
    pub location_id: LocationId,
    pub name: String,
    pub quantity: StockQuantity,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Recipe {
    pub id: RecipeId,
    pub menu_item_id: MenuItemId,
    pub instructions: String,
    pub cost: Money,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StoreShift {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub float_amount: Money,
    pub cash_sales: Money,
    pub upi_sales: Money,
    pub card_sales: Money,
    pub expected_till_amount: Money,
}
