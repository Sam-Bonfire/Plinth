use chrono::{DateTime, Utc};
use core_domain::{
    enums::{order_channel::OrderChannel, order_status::OrderStatus},
    ids::{FloorTableId, MenuItemId, OrderId, TerminalId},
    models::order::Order,
    value_objects::{
        discount::Discount, modifier::ModifierSelection, order_charge::OrderCharge,
        table::SeatNumber, tax::GstRate, tip::TipAmount,
    },
};
use serde::{Deserialize, Serialize};

pub type DiscountDto = Discount;
pub type ChargeDto = OrderCharge;
pub type TipDto = TipAmount;
pub type ModifierSelectionDto = ModifierSelection;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CreateLineItemDto {
    pub menu_item_id: MenuItemId,
    pub name: String,
    #[specta(type = f64)]
    pub unit_price_minor: i64,
    pub quantity: u32,
    pub tax_rate: GstRate,
    pub modifiers: Vec<ModifierSelectionDto>,
    pub notes: Option<String>,
    pub seat_number: Option<SeatNumber>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CreateOrderRequest {
    pub channel: OrderChannel,
    pub terminal_id: TerminalId,
    pub table_id: Option<FloorTableId>,
    pub seat_number: Option<SeatNumber>,
    pub items: Vec<CreateLineItemDto>,
    pub discounts: Vec<DiscountDto>,
    pub charges: Vec<ChargeDto>,
    pub tip: Option<TipDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct OrderResponseDto {
    pub order: Order,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct OrderSummaryDto {
    pub id: OrderId,
    pub status: OrderStatus,
    pub channel: OrderChannel,
    pub terminal_id: TerminalId,
    pub table_id: Option<FloorTableId>,
    #[specta(type = f64)]
    pub grand_total_minor: i64,
    #[specta(type = f64)]
    pub balance_due_minor: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PaginatedResponse<T> {
    pub page: u32,
    pub page_size: u32,
    pub total_records: u32,
    pub total_pages: u32,
    pub data: Vec<T>,
}
