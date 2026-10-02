use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

const CHANNELS: [&str; 3] = ["Swiggy", "Zomato", "Takeaway"];

/// One public order line item.
/// `unit_price_minor` is accepted for API compatibility but ignored:
/// the server always prices from the menu catalog.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicOrderItem {
    pub menu_item_id: String,
    pub name: String,
    pub unit_price_minor: i64,
    pub quantity: i64,
    pub tax_rate: Option<String>,
    pub notes: Option<String>,
}

/// Public order submission payload
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicOrderRequest {
    pub tenant_id: String,
    pub location_id: String,
    pub channel: String,
    pub customer_name: Option<String>,
    pub items: Vec<PublicOrderItem>,
}

/// Response after accepting a public order
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicOrderResponseDto {
    pub success: bool,
    pub order_id: String,
    pub ticket_id: String,
    pub total_minor: i64,
}

/// Registers the public order submission route
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/public/orders", submit_public_order)
        .get_async("/api/v1/public/orders/:id/status", public_order_status)
}

/// A line priced from the server catalog. The name and unit price always
/// come from the menu, never from the request.
pub struct PricedLine {
    pub menu_item_id: String,
    pub name: String,
    pub unit_price_minor: i64,
    pub quantity: i64,
}

/// Prices order lines from the catalog (id to (`name`, `price_minor`)),
/// returning the lines and the order total. Unknown items are rejected
/// so callers cannot invent prices or items.
///
/// # Errors
/// Returns a message when an item is not in the catalog, a line exceeds
/// one hundred entries, or the total overflows.
#[must_use = "pricing errors must become 400 responses"]
pub fn apply_catalog_prices(
    items: &[PublicOrderItem],
    catalog: &std::collections::HashMap<String, (String, i64), impl std::hash::BuildHasher>,
) -> std::result::Result<(Vec<PricedLine>, i64), String> {
    const MAX_LINES: usize = 100;
    if items.len() > MAX_LINES {
        return Err("Order has too many lines".to_string());
    }
    let mut priced = Vec::with_capacity(items.len());
    let mut total: i64 = 0;
    for item in items {
        let Some((name, price)) = catalog.get(&item.menu_item_id) else {
            return Err(format!("Unknown menu item: {}", item.name));
        };
        total = total
            .checked_add(price.checked_mul(item.quantity).ok_or_else(|| {
                format!("Line total overflows for {name}")
            })?)
            .ok_or_else(|| "Order total overflows".to_string())?;
        priced.push(PricedLine {
            menu_item_id: item.menu_item_id.clone(),
            name: name.clone(),
            unit_price_minor: *price,
            quantity: item.quantity,
        });
    }
    Ok((priced, total))
}

/// Validates a public order request shape. Pricing is resolved separately
/// from the catalog; this checks identity, channel, and quantities only.
fn validate(req: &PublicOrderRequest) -> std::result::Result<(), String> {
    if uuid::Uuid::parse_str(&req.tenant_id).is_err() {
        return Err("Invalid tenant_id".to_string());
    }
    if uuid::Uuid::parse_str(&req.location_id).is_err() {
        return Err("Invalid location_id".to_string());
    }
    if !CHANNELS.contains(&req.channel.as_str()) {
        return Err("Unknown channel".to_string());
    }
    if req.items.is_empty() {
        return Err("Order needs at least one item".to_string());
    }
    if req.items.len() > 100 {
        return Err("Order has too many lines".to_string());
    }
    for item in &req.items {
        if uuid::Uuid::parse_str(&item.menu_item_id).is_err() {
            return Err(format!("Invalid menu_item_id for {}", item.name));
        }
        if item.quantity < 1 {
            return Err(format!("Invalid quantity for {}", item.name));
        }
    }
    Ok(())
}

/// Loads available menu prices for a tenant into an id-keyed catalog.
///
/// # Errors
/// Returns an error when the catalog query cannot be prepared or read.
async fn fetch_catalog_prices(
    db: &worker::d1::D1Database,
    tenant_id: &str,
) -> Result<std::collections::HashMap<String, (String, i64)>> {
    let rows: Vec<serde_json::Value> = db
        .prepare(
            "SELECT id, name, price_minor FROM menu_items WHERE tenant_id = ?1 AND is_available = 1 AND deleted_at IS NULL",
        )
        .bind(&[tenant_id.into()])?
        .all()
        .await?
        .results::<serde_json::Value>()?;
    Ok(rows
        .iter()
        .filter_map(|row| {
            Some((
                row.get("id")?.as_str()?.to_string(),
                (
                    row.get("name")?.as_str()?.to_string(),
                    row.get("price_minor")?.as_i64()?,
                ),
            ))
        })
        .collect())
}

/// Accepts a public aggregator order and dispatches a kitchen ticket.
///
/// # Errors
/// Returns an error if validation fails or database writes fail
/// Persists the order head plus its priced lines, returning the order id.
///
/// # Errors
/// Returns an error when any order write fails.
async fn insert_public_order(
    db: &worker::d1::D1Database,
    payload: &PublicOrderRequest,
    lines: &[PricedLine],
    total: i64,
) -> Result<String> {
    let now = chrono::Utc::now().to_rfc3339();
    let order_id = uuid::Uuid::now_v7().to_string();
    let params: Vec<JsValue> = vec![
        order_id.clone().into(),
        payload.tenant_id.clone().into(),
        payload.location_id.clone().into(),
        "public-terminal".into(),
        payload.channel.clone().into(),
        "Confirmed".into(),
        total.into(),
        total.into(),
        "public-api".into(),
        now.clone().into(),
        now.clone().into(),
    ];
    db.prepare(
        "INSERT INTO orders (id, tenant_id, location_id, terminal_id, channel, status, subtotal_minor, total_minor, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&params)?
    .run()
    .await?;

    for (item, line) in payload.items.iter().zip(lines.iter()) {
        let line_params: Vec<JsValue> = vec![
            uuid::Uuid::now_v7().to_string().into(),
            order_id.clone().into(),
            line.menu_item_id.clone().into(),
            line.name.clone().into(),
            line.unit_price_minor.into(),
            line.quantity.into(),
            item.tax_rate.clone().unwrap_or_else(|| "Exempt".to_string()).into(),
            item.notes.clone().map_or(JsValue::null(), Into::into),
        ];
        db.prepare(
            "INSERT INTO order_line_items (id, order_id, menu_item_id, name, unit_price_minor, quantity, tax_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&line_params)?
        .run()
        .await?;
    }
    Ok(order_id)
}

/// Persists the kitchen ticket plus its lines, returning the ticket id.
///
/// # Errors
/// Returns an error when any ticket write fails.
async fn insert_kitchen_ticket(
    db: &worker::d1::D1Database,
    payload: &PublicOrderRequest,
    lines: &[PricedLine],
    order_id: &str,
) -> Result<String> {
    let now = chrono::Utc::now().to_rfc3339();
    let ticket_id = uuid::Uuid::now_v7().to_string();
    let now_secs = chrono::Utc::now().timestamp();
    let kot_number = now_secs % 100_000;
    let ticket_params: Vec<JsValue> = vec![
        ticket_id.clone().into(),
        order_id.into(),
        payload.tenant_id.clone().into(),
        payload.location_id.clone().into(),
        "MainKitchen".into(),
        kot_number.into(),
        "Pending".into(),
        240.into(),
        480.into(),
        now.clone().into(),
    ];
    db.prepare(
        "INSERT INTO kitchen_tickets (id, order_id, tenant_id, location_id, station, kot_number, status, sla_warning_sec, sla_late_sec, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&ticket_params)?
    .run()
    .await?;

    for (item, line) in payload.items.iter().zip(lines.iter()) {
        let ticket_line: Vec<JsValue> = vec![
            uuid::Uuid::now_v7().to_string().into(),
            ticket_id.clone().into(),
            uuid::Uuid::now_v7().to_string().into(),
            line.menu_item_id.clone().into(),
            line.name.clone().into(),
            line.quantity.into(),
            item.notes.clone().map_or(JsValue::null(), Into::into),
        ];
        db.prepare(
            "INSERT INTO ticket_line_items (id, ticket_id, line_item_id, menu_item_id, name, quantity, special_instructions) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&ticket_line)?
        .run()
        .await?;
    }
    Ok(ticket_id)
}

/// Accepts a public aggregator order and dispatches a kitchen ticket.
///
/// # Errors
/// Returns an error if validation fails or database writes fail
pub async fn submit_public_order<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(payload) = req.json::<PublicOrderRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };
    if let Err(e) = validate(&payload) {
        return Response::error(e, 400);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    // Price from the catalog, never from the request.
    let catalog = match fetch_catalog_prices(&db, &payload.tenant_id).await {
        Ok(catalog) => catalog,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };
    let (lines, total) = match apply_catalog_prices(&payload.items, &catalog) {
        Ok(priced) => priced,
        Err(e) => return Response::error(e, 400),
    };

    let order_id = insert_public_order(&db, &payload, &lines, total).await?;
    let ticket_id = insert_kitchen_ticket(&db, &payload, &lines, &order_id).await?;

    let res_dto = PublicOrderResponseDto {
        success: true,
        order_id,
        ticket_id,
        total_minor: total,
    };
    let mut resp = Response::from_json(&res_dto)?;
    resp = resp.with_status(201);
    Ok(resp)
}

/// Public order status, looked up by order id scoped to a tenant.
/// The tenant scope is required so order ids cannot be enumerated across
/// tenants; missing and out-of-scope ids share one 404 response.
///
/// # Errors
/// Returns an error if the id or tenant scope is missing, the order is
/// unknown or out of scope, or the database read fails.
pub async fn public_order_status<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let order_id = ctx.param("id").unwrap_or(&String::new()).clone();
    if order_id.is_empty() {
        return crate::router::json_error("Order ID is required", "BAD_REQUEST", &request_id, 400);
    }
    let tenant_id = req
        .url()
        .ok()
        .and_then(|url| {
            url.query_pairs()
                .find(|(key, _)| key == "tenant_id")
                .map(|(_, value)| value.into_owned())
        })
        .unwrap_or_default();
    if uuid::Uuid::parse_str(&tenant_id).is_err() {
        return crate::router::json_error("tenant_id query is required", "BAD_REQUEST", &request_id, 400);
    }

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    let stmt = db
        .prepare("SELECT status FROM orders WHERE id = ? AND tenant_id = ?")
        .bind(&[order_id.clone().into(), tenant_id.into()])?;
    let row: Option<serde_json::Value> = stmt.first(None).await?;
    let Some(status) = row
        .as_ref()
        .and_then(|v| v.get("status"))
        .and_then(|v| v.as_str())
    else {
        return crate::router::json_error("Order not found", "NOT_FOUND", &request_id, 404);
    };

    Response::from_json(&serde_json::json!({ "order_id": order_id, "status": status }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn catalog() -> std::collections::HashMap<String, (String, i64)> {
        let id = uuid::Uuid::now_v7().to_string();
        std::collections::HashMap::from([(id, ("Burger".to_string(), 20000))])
    }

    fn priced_item(catalog: &std::collections::HashMap<String, (String, i64)>, price: i64, qty: i64) -> PublicOrderItem {
        let menu_item_id = catalog.keys().next().expect("catalog").clone();
        PublicOrderItem {
            menu_item_id,
            name: "Caller Supplied Name".to_string(),
            unit_price_minor: price,
            quantity: qty,
            tax_rate: None,
            notes: None,
        }
    }

    fn request() -> PublicOrderRequest {
        PublicOrderRequest {
            tenant_id: uuid::Uuid::now_v7().to_string(),
            location_id: uuid::Uuid::now_v7().to_string(),
            channel: "Swiggy".to_string(),
            customer_name: None,
            items: vec![PublicOrderItem {
                menu_item_id: uuid::Uuid::now_v7().to_string(),
                name: "Burger".to_string(),
                unit_price_minor: 20000,
                quantity: 2,
                tax_rate: None,
                notes: None,
            }],
        }
    }

    #[test]
    fn prices_from_catalog_not_request() {
        let catalog = catalog();
        let item = priced_item(&catalog, 1, 2);
        let (lines, total) = apply_catalog_prices(std::slice::from_ref(&item), &catalog).expect("valid");
        assert_eq!(total, 40000);
        assert_eq!(lines[0].name, "Burger");
        assert_eq!(lines[0].unit_price_minor, 20000);
    }

    #[test]
    fn rejects_unknown_items_and_bad_shape() {
        let catalog = catalog();
        let mut unknown = priced_item(&catalog, 20000, 1);
        unknown.menu_item_id = uuid::Uuid::now_v7().to_string();
        assert!(apply_catalog_prices(std::slice::from_ref(&unknown), &catalog).is_err());

        let mut bad = request();
        bad.tenant_id = "nope".to_string();
        assert!(validate(&bad).is_err());
        let mut bad = request();
        bad.channel = "DineIn".to_string();
        assert!(validate(&bad).is_err());
        let mut bad = request();
        bad.items = Vec::new();
        assert!(validate(&bad).is_err());
        let mut bad = request();
        bad.items[0].quantity = 0;
        assert!(validate(&bad).is_err());
    }
}
