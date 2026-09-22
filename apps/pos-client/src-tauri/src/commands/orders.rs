use core_domain::enums::order_channel::OrderChannel;
use core_domain::enums::order_status::OrderStatus;
use core_domain::ids::{FloorTableId, LocationId, OrderId, StaffMemberId, TenantId, TerminalId};
use core_domain::models::{Order, OrderLineItem};
use core_domain::value_objects::table::SeatNumber;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::repos::SqliteOrderRepository;
use crate::state::db_path;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SubmitOrderRequest {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub terminal_id: TerminalId,
    pub channel: OrderChannel,
    pub created_by: StaffMemberId,
    pub table_id: Option<FloorTableId>,
    pub seat_number: Option<SeatNumber>,
    pub items: Vec<OrderLineItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AdvanceOrderStatusRequest {
    pub order_id: OrderId,
    pub target_status: OrderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VoidOrderRequest {
    pub order_id: OrderId,
    pub reason: String,
    pub voided_by: StaffMemberId,
    pub is_supervisor: bool,
}

/// Submits a new order.
///
/// # Errors
///
/// Returns an error if the database path cannot be found or if DB operations fail.
#[tauri::command]
pub async fn submit_order(
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppContext>,
    req: SubmitOrderRequest,
) -> Result<OrderId, String> {
    submit_order_impl(&db_path(&app)?, &state, req).await
}

pub async fn submit_order_impl(
    db: &std::path::Path,
    ctx: &crate::state::AppContext,
    mut req: SubmitOrderRequest,
) -> Result<OrderId, String> {
    req.tenant_id = ctx.tenant_id;
    req.location_id = ctx.location_id;
    let repo = SqliteOrderRepository::new(db.to_path_buf());

    let (mut order, _event) = Order::new(
        req.tenant_id,
        req.location_id,
        req.terminal_id,
        req.channel,
        req.created_by,
        req.table_id,
        req.seat_number,
    );

    for item in req.items {
        order.add_item(item).map_err(|e| e.to_string())?;
    }

    core_domain::ports::OrderRepository::save(&repo, &order)
        .await
        .map_err(|e| e.to_string())?;

    Ok(order.id)
}

/// Retrieves active orders for a table.
///
/// # Errors
///
/// Returns an error if DB operations fail.
#[tauri::command]
pub async fn get_active_orders(
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppContext>,
    table_id: FloorTableId,
) -> Result<Vec<Order>, String> {
    get_active_orders_impl(&db_path(&app)?, &state, table_id).await
}

pub async fn get_active_orders_impl(
    db: &std::path::Path,
    ctx: &crate::state::AppContext,
    table_id: FloorTableId,
) -> Result<Vec<Order>, String> {
    let repo = SqliteOrderRepository::new(db.to_path_buf());

    core_domain::ports::OrderRepository::find_active_by_table(&repo, ctx.location_id, table_id)
        .await
        .map_err(|e| e.to_string())
}

/// Advances the status of an order.
///
/// # Errors
///
/// Returns an error if DB operations fail, if the order is not found, or if the status transition is invalid.
#[tauri::command]
pub async fn advance_order_status(
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppContext>,
    req: AdvanceOrderStatusRequest,
) -> Result<(), String> {
    advance_order_status_impl(&db_path(&app)?, &state, req).await
}

pub async fn advance_order_status_impl(
    db: &std::path::Path,
    ctx: &crate::state::AppContext,
    req: AdvanceOrderStatusRequest,
) -> Result<(), String> {
    let repo = SqliteOrderRepository::new(db.to_path_buf());

    let mut order = core_domain::ports::OrderRepository::find_by_id(&repo, req.order_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Order not found".to_string())?;

    if order.tenant_id != ctx.tenant_id || order.location_id != ctx.location_id {
        return Err("Permission denied".to_string());
    }

    order.status = order.status.transition_to(req.target_status).map_err(|e| e.to_string())?;

    core_domain::ports::OrderRepository::save(&repo, &order)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Voids an order.
///
/// # Errors
///
/// Returns an error if DB operations fail, if the order is not found, or if the user lacks permissions.
#[tauri::command]
pub async fn void_order(
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppContext>,
    req: VoidOrderRequest,
) -> Result<(), String> {
    void_order_impl(&db_path(&app)?, &state, req).await
}

pub async fn void_order_impl(
    db: &std::path::Path,
    ctx: &crate::state::AppContext,
    req: VoidOrderRequest,
) -> Result<(), String> {
    let repo = SqliteOrderRepository::new(db.to_path_buf());

    let mut order = core_domain::ports::OrderRepository::find_by_id(&repo, req.order_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Order not found".to_string())?;

    if order.tenant_id != ctx.tenant_id || order.location_id != ctx.location_id {
        return Err("Permission denied".to_string());
    }

    order
        .void_order(req.reason, req.voided_by, req.is_supervisor)
        .map_err(|e| e.to_string())?;

    core_domain::ports::OrderRepository::save(&repo, &order)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::value_objects::money::{Currency, Money};
    use core_domain::value_objects::tax::GstRate;

    fn temp_db_path(tag: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "plinth-pos-test-{}-{}-{}.db",
            tag,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock before epoch")
                .as_nanos()
        ));
        path
    }

    fn migrated_file_db(tag: &str) -> (rusqlite::Connection, std::path::PathBuf) {
        let path = temp_db_path(tag);
        let mut conn = crate::db::open_db(&path).expect("open test db");
        crate::migrations::migrate(&mut conn).expect("migrate");
        (conn, path)
    }

    fn minor(amount: i64) -> Money {
        Money::from_minor_units(amount, Currency::Inr)
    }

    #[tokio::test]
    async fn order_commands_round_trip() {
        let (_conn, path) = migrated_file_db("order_cmds");
        let repo = crate::repos::SqliteOrderRepository::new(path.clone());

        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();
        let table_id = FloorTableId::new();

        let req = SubmitOrderRequest {
            tenant_id,
            location_id,
            terminal_id,
            channel: OrderChannel::DineIn,
            created_by: staff_id,
            table_id: Some(table_id),
            seat_number: None,
            items: vec![OrderLineItem {
                id: core_domain::ids::OrderLineItemId::new(),
                menu_item_id: core_domain::ids::MenuItemId::new(),
                name: "Burger".to_string(),
                base_price: minor(10000),
                modifier_selections: vec![],
                modifier_total: minor(0),
                unit_price: minor(10000),
                quantity: 1,
                fired_quantity: 0,
                tax_rate: GstRate::FivePercent,
                notes: None,
                seat_number: None,
            }],
        };

        let (mut order, _event) = core_domain::models::Order::new(
            req.tenant_id,
            req.location_id,
            req.terminal_id,
            req.channel,
            req.created_by,
            req.table_id,
            req.seat_number,
        );

        for item in req.items {
            order.add_item(item).expect("add item");
        }

        core_domain::ports::OrderRepository::save(&repo, &order)
            .await
            .expect("save");

        let order_id = order.id;

        let active_orders = core_domain::ports::OrderRepository::find_active_by_table(&repo, location_id, table_id)
            .await
            .expect("query active");

        assert_eq!(active_orders.len(), 1);
        assert_eq!(active_orders[0].id, order_id);

        let mut loaded_order = core_domain::ports::OrderRepository::find_by_id(&repo, order_id)
            .await
            .expect("find by id")
            .expect("order exists");

        loaded_order.status = loaded_order.status.transition_to(OrderStatus::Confirmed).expect("transition");

        core_domain::ports::OrderRepository::save(&repo, &loaded_order)
            .await
            .expect("save advanced");

        let advanced_order = core_domain::ports::OrderRepository::find_by_id(&repo, order_id)
            .await
            .expect("find by id")
            .expect("order exists");

        assert_eq!(advanced_order.status, OrderStatus::Confirmed);

        loaded_order.void_order("Changed mind".to_string(), staff_id, true).expect("void");
        core_domain::ports::OrderRepository::save(&repo, &loaded_order)
            .await
            .expect("save voided");

        let voided_order = core_domain::ports::OrderRepository::find_by_id(&repo, order_id)
            .await
            .expect("find by id")
            .expect("order exists");

        assert_eq!(voided_order.status, OrderStatus::Voided);

        let _ = std::fs::remove_file(&path);
    }
}
