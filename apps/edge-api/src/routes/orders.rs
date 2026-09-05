use crate::dto::order::{
    CreateOrderRequest, OrderResponseDto, OrderSummaryDto, PaginatedResponse,
};
use core_domain::{
    enums::staff::Permissions,
    ids::{OrderId, OrderLineItemId},
    models::order::{Order, OrderLineItem},
    value_objects::{
        money::{Currency, Money},
        tax::GstApplicability,
    },
};
use std::fmt::Write as _;
use worker::{wasm_bindgen::JsValue, Request, Response, Result, RouteContext, Router};

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/orders", create_order)
        .get_async("/api/v1/orders", list_orders)
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
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return Response::error("Unauthorized", 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::TAKE_ORDER,
    ) else {
        return Response::error("Unauthorized", 401);
    };

    let tenant_id = tenant_ctx.tenant_id;
    let location_id = tenant_ctx.location_id;
    let staff_id = tenant_ctx.staff_id;

    let payload: CreateOrderRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return Response::error(format!("Invalid JSON payload: {e}"), 400),
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

    let grand_total_minor = order
        .grand_total(&GstApplicability::IntraState)
        .to_minor_units();
    let balance_due_minor = order
        .balance_due(&GstApplicability::IntraState)
        .to_minor_units();

    let order_json = match serde_json::to_string(&order) {
        Ok(j) => j,
        Err(e) => return Response::error(format!("Serialization error: {e}"), 500),
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
            "INSERT INTO orders (id, tenant_id, location_id, terminal_id, status, channel, table_id, grand_total_minor, balance_due_minor, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
        )
        .bind(&[
            order_id.to_string().into(),
            tenant_id.to_string().into(),
            location_id.to_string().into(),
            order.terminal_id.to_string().into(),
            status_str.into(),
            channel_str.into(),
            table_id_str.into(),
            (grand_total_minor as f64).into(),
            (balance_due_minor as f64).into(),
            order_json.into(),
            created_at_str.clone().into(),
        ])?;

    let mut batch = vec![stmt_order];

    for item in &order.items {
        let stmt_line_item = db
            .prepare(
                "INSERT INTO order_line_items (id, order_id, menu_item_id, quantity, unit_price_minor) VALUES (?1, ?2, ?3, ?4, ?5)"
            )
            .bind(&[
                item.id.to_string().into(),
                order_id.to_string().into(),
                item.menu_item_id.to_string().into(),
                f64::from(item.quantity).into(),
                (item.unit_price.to_minor_units() as f64).into(),
            ])?;
        batch.push(stmt_line_item);
    }

    let stmt_audit = db
        .prepare(
            "INSERT INTO audit_events (action, entity_id, actor_id, created_at) VALUES (?1, ?2, ?3, ?4)"
        )
        .bind(&[
            "ORDER_CREATED".into(),
            order_id.to_string().into(),
            staff_id.to_string().into(),
            created_at_str.into(),
        ])?;
    batch.push(stmt_audit);

    if let Err(e) = db.batch(batch).await {
        return Response::error(format!("Database error: {e:?}"), 500);
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
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return Response::error("Unauthorized", 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return Response::error("Unauthorized", 401);
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
                let summary = OrderSummaryDto {
                    id: order.id,
                    status: order.status,
                    channel: order.channel,
                    terminal_id: order.terminal_id,
                    table_id: order.table_id,
                    grand_total_minor: order
                        .grand_total(&GstApplicability::IntraState)
                        .to_minor_units(),
                    balance_due_minor: order
                        .balance_due(&GstApplicability::IntraState)
                        .to_minor_units(),
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
                .to_minor_units(),
            balance_due_minor: order
                .balance_due(&GstApplicability::IntraState)
                .to_minor_units(),
            created_at: order.created_at,
        };

        assert_eq!(summary.status, OrderStatus::Confirmed);
        assert_eq!(summary.channel, OrderChannel::Takeaway);
        assert_eq!(summary.grand_total_minor, 0);
    }
}
