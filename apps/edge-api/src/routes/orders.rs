use crate::dto::order::{
    CreateOrderRequest, OrderResponseDto, OrderStatusResponseDto, OrderSummaryDto,
    PaginatedResponse,
};
use core_domain::{
    enums::{order_status::OrderStatus, staff::Permissions},
    ids::{AuditEventId, MenuItemId, OrderId, OrderLineItemId, RecipeId, StockItemId},
    models::{
        inventory::{Recipe, RecipeIngredient},
        order::{Order, OrderLineItem},
    },
    services::inventory_deduction::InventoryDeductionService,
    value_objects::{
        measurement::{StockQuantity, UnitOfMeasure},
        money::{Currency, Money},
        tax::GstApplicability,
    },
};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::str::FromStr;
use worker::{wasm_bindgen::JsValue, Request, Response, Result, RouteContext, Router};

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/orders", create_order)
        .get_async("/api/v1/orders", list_orders)
        .get_async("/api/v1/orders/:id/status", get_order_status)
}

#[derive(serde::Deserialize)]
struct RecipeRow {
    id: String,
    menu_item_id: String,
    stock_item_id: String,
    quantity: String,
    unit: String,
    wastage_percent: String,
}

/// Groups joined recipe/ingredient rows into one recipe per menu item.
///
/// # Errors
/// Returns an error if a row carries a malformed identifier, unit or decimal.
fn group_recipes(rows: Vec<RecipeRow>) -> std::result::Result<HashMap<MenuItemId, Recipe>, String> {
    let mut recipes: HashMap<MenuItemId, Recipe> = HashMap::new();

    for row in rows {
        let menu_item_id = MenuItemId::from(
            uuid::Uuid::parse_str(&row.menu_item_id).map_err(|e| e.to_string())?,
        );
        let unit: UnitOfMeasure = serde_json::from_value(serde_json::Value::String(row.unit))
            .map_err(|e| e.to_string())?;

        let ingredient = RecipeIngredient {
            stock_item_id: StockItemId::from(
                uuid::Uuid::parse_str(&row.stock_item_id).map_err(|e| e.to_string())?,
            ),
            quantity: StockQuantity {
                value: Decimal::from_str(&row.quantity).map_err(|e| e.to_string())?,
                unit,
            },
            wastage_percent: Decimal::from_str(&row.wastage_percent).map_err(|e| e.to_string())?,
        };

        recipes
            .entry(menu_item_id)
            .or_insert_with(|| Recipe {
                id: RecipeId::from(uuid::Uuid::parse_str(&row.id).unwrap_or_default()),
                menu_item_id,
                ingredients: Vec::new(),
                preparation_notes: None,
            })
            .ingredients
            .push(ingredient);
    }

    Ok(recipes)
}

/// Ingests a new order into the database.
///
/// # Errors
/// Returns an error if the request body is invalid, authorization fails, or database transaction fails.
#[allow(clippy::too_many_lines, clippy::cast_possible_truncation, clippy::cast_precision_loss)]
pub async fn create_order<D>(
    mut req: Request,
    ctx: RouteContext<D>,
) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::TAKE_ORDER,
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let tenant_id = tenant_ctx.tenant_id;
    let location_id = tenant_ctx.location_id;
    let staff_id = tenant_ctx.staff_id;

    let payload: CreateOrderRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    let db = ctx.env.d1("CELLAR_DB")?;

    let order_id = OrderId::new();
    let now = chrono::Utc::now();

    let mut line_items = Vec::with_capacity(payload.items.len());
    for item in payload.items {
        let line_item_id = OrderLineItemId::new();
        let base_price = Money::from_minor_units(item.unit_price_minor, Currency::Inr);
        let modifier_total = Money::zero(Currency::Inr);
        let unit_price = base_price.clone();

        line_items.push(OrderLineItem {
            id: line_item_id,
            menu_item_id: item.menu_item_id,
            name: item.name,
            base_price,
            modifier_selections: item.modifiers,
            modifier_total,
            unit_price,
            quantity: item.quantity,
            fired_quantity: 0,
            tax_rate: item.tax_rate,
            notes: item.notes,
            seat_number: item.seat_number,
        });
    }

    let (mut order, _created_event) = Order::new(
        tenant_id,
        location_id,
        payload.terminal_id,
        payload.channel,
        staff_id,
        payload.table_id,
        payload.seat_number,
    );
    order.id = order_id;
    order.items = line_items;
    order.discounts = payload.discounts;
    order.charges = payload.charges;
    order.tip = payload.tip;
    order.created_at = now;
    order.updated_at = now;
    // A submitted order is confirmed: the kitchen only picks up confirmed tickets.
    order.status = match order.status.transition_to(OrderStatus::Confirmed) {
        Ok(status) => status,
        Err(e) => return crate::router::json_error(format!("Invalid order status: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    let grand_total = match order.grand_total(&GstApplicability::IntraState) {
        Ok(total) => total,
        Err(e) => return crate::router::json_error(format!("Invalid order totals: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };
    let balance_due = match order.balance_due(&GstApplicability::IntraState) {
        Ok(due) => due,
        Err(e) => return crate::router::json_error(format!("Invalid order totals: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };
    let grand_total_minor = grand_total.to_minor_units();
    let balance_due_minor = balance_due.to_minor_units();
    let subtotal_minor = order.subtotal().to_minor_units();
    let discount_minor = match order.discount_total() {
        Ok(discount) => discount.to_minor_units(),
        Err(e) => return crate::router::json_error(format!("Invalid discount: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };
    let charge_minor = order.charge_total().to_minor_units();
    let tax_minor = order
        .compute_tax_breakdown(&GstApplicability::IntraState)
        .total_tax
        .to_minor_units();
    let total_paid_minor = order.total_paid().to_minor_units();

    let order_json = match serde_json::to_string(&order) {
        Ok(j) => j,
        Err(e) => return crate::router::json_error(format!("Serialization error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    let table_id_str = order.table_id.map(|t| t.to_string()).unwrap_or_default();
    let channel_str = serde_json::to_string(&order.channel)
        .unwrap_or_default()
        .replace('"', "");
    let status_str = serde_json::to_string(&order.status)
        .unwrap_or_default()
        .replace('"', "");
    let created_at_str = order.created_at.to_rfc3339();

    let stmt_order = db
        .prepare(
            "INSERT INTO orders (id, tenant_id, location_id, terminal_id, status, channel, table_id, subtotal_minor, discount_minor, tax_minor, charges_minor, total_minor, grand_total_minor, balance_due_minor, total_paid_minor, payload, created_by, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)"
        )
        .bind(&[
            order_id.to_string().into(),
            tenant_id.to_string().into(),
            location_id.to_string().into(),
            order.terminal_id.to_string().into(),
            status_str.into(),
            channel_str.into(),
            table_id_str.into(),
            crate::db::money(subtotal_minor),
            crate::db::money(discount_minor),
            crate::db::money(tax_minor),
            crate::db::money(charge_minor),
            crate::db::money(grand_total_minor),
            crate::db::money(grand_total_minor),
            crate::db::money(balance_due_minor),
            crate::db::money(total_paid_minor),
            order_json.into(),
            staff_id.to_string().into(),
            created_at_str.clone().into(),
            created_at_str.clone().into(),
        ])?;

    let mut batch = vec![stmt_order];

    for item in &order.items {
        let item_tax_str = serde_json::to_string(&item.tax_rate)
            .unwrap_or_default()
            .replace('"', "");
        let stmt_line_item = db
            .prepare(
                "INSERT INTO order_line_items (id, order_id, menu_item_id, name, unit_price_minor, quantity, fired_quantity, tax_rate, notes, seat_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
            )
            .bind(&[
                item.id.to_string().into(),
                order_id.to_string().into(),
                item.menu_item_id.to_string().into(),
                item.name.clone().into(),
                crate::db::money(item.unit_price.to_minor_units()),
                crate::db::money(i64::from(item.quantity)),
                crate::db::money(i64::from(item.fired_quantity)),
                item_tax_str.into(),
                item.notes.clone().map_or(JsValue::null(), Into::into),
                item.seat_number
                    .map_or(JsValue::null(), |seat| crate::db::money(i64::from(seat.value()))),
            ])?;
        batch.push(stmt_line_item);
    }

    let stmt_audit = db
        .prepare(
            "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        )
        .bind(&[
            AuditEventId::new().to_string().into(),
            tenant_id.to_string().into(),
            location_id.to_string().into(),
            staff_id.to_string().into(),
            "ORDER_CREATED".into(),
            "order".into(),
            order_id.to_string().into(),
            JsValue::null(),
            crate::db::money(0),
            created_at_str.clone().into(),
        ])?;
    batch.push(stmt_audit);

    // Stock deductions ride in the same batch as the order, so an order never
    // commits without its ingredient movements. Negative stock is allowed on
    // purpose: a stale count must not stop service, and the item surfaces
    // through below_reorder until someone recounts it.
    let recipe_rows: Vec<RecipeRow> = db
        .prepare(
            "SELECT r.id, r.menu_item_id, ri.stock_item_id, ri.quantity, ri.unit, ri.wastage_percent
             FROM recipes r JOIN recipe_ingredients ri ON ri.recipe_id = r.id
             WHERE r.tenant_id = ?1 AND r.location_id = ?2 AND r.deleted_at IS NULL",
        )
        .bind(&[tenant_id.to_string().into(), location_id.to_string().into()])?
        .all()
        .await?
        .results()?;
    let recipes = match group_recipes(recipe_rows) {
        Ok(recipes) => recipes,
        Err(e) => return crate::router::json_error(format!("Invalid recipe data: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };
    let deductions = InventoryDeductionService::calculate_deductions(&order, &recipes);

    for deduction in deductions {
        let stock_id = deduction.stock_item_id.to_string();
        let Some(row) = db
            .prepare("SELECT current_quantity FROM stock_items WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3")
            .bind(&[stock_id.clone().into(), tenant_id.to_string().into(), location_id.to_string().into()])?
            .first::<serde_json::Value>(None)
            .await?
        else {
            return crate::router::json_error(format!("Recipe references unknown stock item {stock_id}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
        };
        let old_qty_str = row.get("current_quantity").and_then(serde_json::Value::as_str).unwrap_or_default();
        let old_qty = match Decimal::from_str(old_qty_str) {
            Ok(q) => q,
            Err(e) => return crate::router::json_error(format!("Invalid stock quantity: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
        };
        let new_qty = old_qty - deduction.quantity_to_deduct;

        // shortcut: this compares the quantity we just read, so a concurrent
        // write between the read and the batch makes the update a no-op instead
        // of retrying. D1 serialises writers and one ingredient rarely moves
        // twice in the same instant; upgrade to a retried transaction when the
        // stock ledger grows beyond per-order deductions.
        let stmt_stock = db
            .prepare("UPDATE stock_items SET current_quantity = ?1 WHERE id = ?2 AND current_quantity = ?3")
            .bind(&[
                new_qty.to_string().into(),
                stock_id.clone().into(),
                old_qty_str.into(),
            ])?;
        batch.push(stmt_stock);

        let payload = serde_json::json!({
            "old_qty": old_qty.to_string(),
            "new_qty": new_qty.to_string(),
            "quantity_to_deduct": deduction.quantity_to_deduct.to_string(),
            "order_id": order_id.to_string(),
            "reason": deduction.reason,
        });
        let stmt_deducted = db
            .prepare(
                "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
            )
            .bind(&[
                AuditEventId::new().to_string().into(),
                tenant_id.to_string().into(),
                location_id.to_string().into(),
                staff_id.to_string().into(),
                "STOCK_DEDUCTED".into(),
                "stock_item".into(),
                stock_id.into(),
                payload.to_string().into(),
                crate::db::money(0),
                created_at_str.clone().into(),
            ])?;
        batch.push(stmt_deducted);
    }

    if let Err(e) = db.batch(batch).await {
        return crate::router::json_error(format!("Database error: {e:?}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    }

    let response_body = OrderResponseDto { order };
    Response::from_json(&response_body).map(|res| res.with_status(201))
}

#[derive(serde::Deserialize, Default)]
pub struct ListOrdersQuery {
    pub status: Option<core_domain::enums::order_status::OrderStatus>,
    pub channel: Option<core_domain::enums::order_channel::OrderChannel>,
    pub terminal_id: Option<core_domain::ids::TerminalId>,
    pub table_id: Option<core_domain::ids::FloorTableId>,
    pub date_from: Option<chrono::DateTime<chrono::Utc>>,
    pub date_to: Option<chrono::DateTime<chrono::Utc>>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

/// Lists orders with pagination and filtering.
///
/// # Errors
/// Returns an error if the query parameters are invalid or database operations fail.
#[allow(clippy::too_many_lines, clippy::cast_possible_truncation)]
pub async fn list_orders<D>(
    req: Request,
    ctx: RouteContext<D>,
) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::empty(),
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let tenant_id = tenant_ctx.tenant_id;
    let location_id = tenant_ctx.location_id;

    let url = req.url()?;
    let query_map: std::collections::HashMap<String, String> =
        url.query_pairs().into_owned().collect();

    let page: u32 = query_map
        .get("page")
        .and_then(|p| p.parse().ok())
        .unwrap_or(1);
    let page_size: u32 = query_map
        .get("page_size")
        .and_then(|p| p.parse().ok())
        .unwrap_or(20)
        .min(100);
    let offset = (page.saturating_sub(1)) * page_size;

    let db = ctx.env.d1("CELLAR_DB")?;

    let mut sql =
        "SELECT payload FROM orders WHERE tenant_id = ?1 AND location_id = ?2".to_string();
    let mut count_sql =
        "SELECT COUNT(*) as total FROM orders WHERE tenant_id = ?1 AND location_id = ?2"
            .to_string();

    let mut params: Vec<JsValue> = vec![
        tenant_id.to_string().into(),
        location_id.to_string().into(),
    ];
    let mut param_idx = 3;

    if let Some(status_str) = query_map.get("status") {
        let _ = write!(sql, " AND status = ?{param_idx}");
        let _ = write!(count_sql, " AND status = ?{param_idx}");
        params.push(status_str.clone().into());
        param_idx += 1;
    }

    if let Some(channel_str) = query_map.get("channel") {
        let _ = write!(sql, " AND channel = ?{param_idx}");
        let _ = write!(count_sql, " AND channel = ?{param_idx}");
        params.push(channel_str.clone().into());
        param_idx += 1;
    }

    if let Some(terminal_id_str) = query_map.get("terminal_id") {
        let _ = write!(sql, " AND terminal_id = ?{param_idx}");
        let _ = write!(count_sql, " AND terminal_id = ?{param_idx}");
        params.push(terminal_id_str.clone().into());
        param_idx += 1;
    }

    if let Some(table_id_str) = query_map.get("table_id") {
        let _ = write!(sql, " AND table_id = ?{param_idx}");
        let _ = write!(count_sql, " AND table_id = ?{param_idx}");
        params.push(table_id_str.clone().into());
        param_idx += 1;
    }

    if let Some(date_from_str) = query_map.get("date_from") {
        let _ = write!(sql, " AND created_at >= ?{param_idx}");
        let _ = write!(count_sql, " AND created_at >= ?{param_idx}");
        params.push(date_from_str.clone().into());
        param_idx += 1;
    }

    if let Some(date_to_str) = query_map.get("date_to") {
        let _ = write!(sql, " AND created_at <= ?{param_idx}");
        let _ = write!(count_sql, " AND created_at <= ?{param_idx}");
        params.push(date_to_str.clone().into());
    }

    let _ = write!(
        sql,
        " ORDER BY created_at DESC LIMIT {page_size} OFFSET {offset}"
    );

    let count_stmt = db.prepare(&count_sql).bind(&params)?;
    let count_res: worker::d1::D1Result = count_stmt.all().await?;
    let total_records: u32 = count_res
        .results::<serde_json::Value>()?
        .first()
        .and_then(|r| r.get("total"))
        .and_then(serde_json::Value::as_u64)
        .map_or(0, |n| u32::try_from(n).unwrap_or(0));

    let total_pages = if total_records == 0 {
        0
    } else {
        total_records.div_ceil(page_size)
    };

    let stmt = db.prepare(&sql).bind(&params)?;
    let rows_res: worker::d1::D1Result = stmt.all().await?;
    let rows: Vec<serde_json::Value> = rows_res.results()?;

    let mut data = Vec::new();
    for row in rows {
        if let Some(payload_str) = row.get("payload").and_then(serde_json::Value::as_str) {
            if let Ok(order) = serde_json::from_str::<Order>(payload_str) {
                // Stored payloads were validated at creation; skip corrupt rows
                // rather than failing the whole listing or reporting zero.
                let Ok(grand_total) = order.grand_total(&GstApplicability::IntraState) else {
                    continue;
                };
                let Ok(balance_due) = order.balance_due(&GstApplicability::IntraState) else {
                    continue;
                };
                let summary = OrderSummaryDto {
                    id: order.id,
                    status: order.status,
                    channel: order.channel,
                    terminal_id: order.terminal_id,
                    table_id: order.table_id,
                    grand_total_minor: grand_total.to_minor_units(),
                    balance_due_minor: balance_due.to_minor_units(),
                    created_at: order.created_at,
                };
                data.push(summary);
            }
        }
    }

    let response = PaginatedResponse {
        page,
        page_size,
        total_records,
        total_pages,
        data,
    };

    Response::from_json(&response)
}



/// Gets the live status of a specific order.
///
/// # Errors
/// Returns an error if the request is unauthorized, the order is not found, or database operations fail.
pub async fn get_order_status<D>(
    req: Request,
    ctx: RouteContext<D>,
) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::empty(),
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let tenant_id = tenant_ctx.tenant_id;
    let location_id = tenant_ctx.location_id;

    let order_id = ctx.param("id").unwrap_or(&String::new()).clone();
    if order_id.is_empty() {
        return crate::router::json_error("Order ID is required", "BAD_REQUEST", &crate::router::get_request_id(&req), 400);
    }

    let db = ctx.env.d1("CELLAR_DB")?;

    let sql = "SELECT payload FROM orders WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3";
    let stmt = db.prepare(sql).bind(&[
        order_id.clone().into(),
        tenant_id.to_string().into(),
        location_id.to_string().into(),
    ])?;

    let row: Option<serde_json::Value> = stmt.first(None).await?;

    let Some(row) = row else {
        return crate::router::json_error("Order not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    };

    let Some(payload_str) = row.get("payload").and_then(|v| v.as_str()) else {
         return crate::router::json_error("Invalid order data", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };

    let Ok(order) = serde_json::from_str::<Order>(payload_str) else {
        return crate::router::json_error("Failed to parse order", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };

    let response_body = OrderStatusResponseDto {
        order_id: order.id,
        status: order.status,
        updated_at: order.updated_at,
    };

    Response::from_json(&response_body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::{
        enums::order_channel::OrderChannel,
        enums::order_status::OrderStatus,
        ids::{MenuItemId, TerminalId},
        value_objects::tax::GstRate,
    };

    #[test]
    fn test_create_order_request_serialization() {
        let req = CreateOrderRequest {
            channel: OrderChannel::DineIn,
            terminal_id: TerminalId::new(),
            table_id: None,
            seat_number: None,
            items: vec![crate::dto::order::CreateLineItemDto {
                menu_item_id: MenuItemId::new(),
                name: "Butter Chicken".to_string(),
                unit_price_minor: 45000,
                quantity: 2,
                tax_rate: GstRate::FivePercent,
                modifiers: vec![],
                notes: Some("Extra spicy".to_string()),
                seat_number: None,
            }],
            discounts: vec![],
            charges: vec![],
            tip: None,
        };

        let serialized = serde_json::to_string(&req).expect("Serialization failed");
        assert!(serialized.contains("Butter Chicken"));
        assert!(serialized.contains("45000"));

        let deserialized: CreateOrderRequest =
            serde_json::from_str(&serialized).expect("Deserialization failed");
        assert_eq!(deserialized.items.len(), 1);
        assert_eq!(deserialized.items[0].name, "Butter Chicken");
    }

    #[test]
    fn test_order_summary_dto_mapping() {
        let (mut order, _) = Order::new(
            core_domain::ids::TenantId::new(),
            core_domain::ids::LocationId::new(),
            TerminalId::new(),
            OrderChannel::Takeaway,
            core_domain::ids::StaffMemberId::new(),
            None,
            None,
        );
        order.status = OrderStatus::Confirmed;

        let summary = OrderSummaryDto {
            id: order.id,
            status: order.status,
            channel: order.channel,
            terminal_id: order.terminal_id,
            table_id: order.table_id,
            grand_total_minor: order
                .grand_total(&GstApplicability::IntraState)
                .expect("test order has no discounts")
                .to_minor_units(),
            balance_due_minor: order
                .balance_due(&GstApplicability::IntraState)
                .expect("test order has no discounts")
                .to_minor_units(),
            created_at: order.created_at,
        };

        assert_eq!(summary.status, OrderStatus::Confirmed);
        assert_eq!(summary.channel, OrderChannel::Takeaway);
        assert_eq!(summary.grand_total_minor, 0);
    }

    #[test]
    fn test_order_status_response_dto_mapping() {
        use crate::dto::order::OrderStatusResponseDto;
        let (mut order, _) = Order::new(
            core_domain::ids::TenantId::new(),
            core_domain::ids::LocationId::new(),
            TerminalId::new(),
            OrderChannel::Takeaway,
            core_domain::ids::StaffMemberId::new(),
            None,
            None,
        );
        order.status = OrderStatus::Preparing;

        let dto = OrderStatusResponseDto {
            order_id: order.id,
            status: order.status,
            updated_at: order.updated_at,
        };

        assert_eq!(dto.order_id, order.id);
        assert_eq!(dto.status, OrderStatus::Preparing);
        assert_eq!(dto.updated_at, order.updated_at);

        let serialized = serde_json::to_string(&dto).expect("Serialization failed");
        assert!(serialized.contains("Preparing"));
    }

    #[test]
    fn test_group_recipes_collects_ingredients_per_menu_item() {
        let recipe_a = RecipeId::new();
        let recipe_b = RecipeId::new();
        let menu_item_a = MenuItemId::new();
        let menu_item_b = MenuItemId::new();
        let rows = vec![
            RecipeRow {
                id: recipe_a.to_string(),
                menu_item_id: menu_item_a.to_string(),
                stock_item_id: StockItemId::new().to_string(),
                quantity: "0.200".to_string(),
                unit: "Kilogram".to_string(),
                wastage_percent: "10".to_string(),
            },
            RecipeRow {
                id: recipe_a.to_string(),
                menu_item_id: menu_item_a.to_string(),
                stock_item_id: StockItemId::new().to_string(),
                quantity: "2".to_string(),
                unit: "Piece".to_string(),
                wastage_percent: "0".to_string(),
            },
            RecipeRow {
                id: recipe_b.to_string(),
                menu_item_id: menu_item_b.to_string(),
                stock_item_id: StockItemId::new().to_string(),
                quantity: "0.050".to_string(),
                unit: "Kilogram".to_string(),
                wastage_percent: "0".to_string(),
            },
        ];

        let recipes = group_recipes(rows).expect("rows are well formed");

        assert_eq!(recipes.len(), 2);
        assert_eq!(recipes[&menu_item_a].ingredients.len(), 2);
        assert_eq!(recipes[&menu_item_a].id, recipe_a);
        assert_eq!(
            recipes[&menu_item_a].ingredients[0].wastage_percent,
            Decimal::new(10, 0)
        );
        assert_eq!(recipes[&menu_item_b].ingredients.len(), 1);
    }

    #[test]
    fn test_group_recipes_rejects_a_malformed_quantity() {
        let rows = vec![RecipeRow {
            id: RecipeId::new().to_string(),
            menu_item_id: MenuItemId::new().to_string(),
            stock_item_id: StockItemId::new().to_string(),
            quantity: "not-a-number".to_string(),
            unit: "Kilogram".to_string(),
            wastage_percent: "0".to_string(),
        }];

        assert!(group_recipes(rows).is_err());
    }
}
