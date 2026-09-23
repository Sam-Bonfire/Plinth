use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

const CHANNELS: [&str; 3] = ["Swiggy", "Zomato", "Takeaway"];

/// One public order line item
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
    router.post_async("/api/v1/public/orders", submit_public_order)
}

/// Validates a public order request, returning the computed total.
fn validate(req: &PublicOrderRequest) -> std::result::Result<i64, String> {
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
    let mut total: i64 = 0;
    for item in &req.items {
        if uuid::Uuid::parse_str(&item.menu_item_id).is_err() {
            return Err(format!("Invalid menu_item_id for {}", item.name));
        }
        if item.quantity < 1 {
            return Err(format!("Invalid quantity for {}", item.name));
        }
        if item.unit_price_minor < 0 {
            return Err(format!("Invalid price for {}", item.name));
        }
        total = total
            .checked_add(item.unit_price_minor.checked_mul(item.quantity).ok_or_else(|| {
                format!("Line total overflows for {}", item.name)
            })?)
            .ok_or_else(|| "Order total overflows".to_string())?;
    }
    Ok(total)
}

/// Accepts a public aggregator order and dispatches a kitchen ticket.
///
/// # Errors
/// Returns an error if validation fails or database writes fail
pub async fn submit_public_order<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(payload) = req.json::<PublicOrderRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };
    let total = match validate(&payload) {
        Ok(total) => total,
        Err(e) => return Response::error(e, 400),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

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

    for item in &payload.items {
        let line_params: Vec<JsValue> = vec![
            uuid::Uuid::now_v7().to_string().into(),
            order_id.clone().into(),
            item.menu_item_id.clone().into(),
            item.name.clone().into(),
            item.unit_price_minor.into(),
            item.quantity.into(),
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

    let ticket_id = uuid::Uuid::now_v7().to_string();
    let now_secs = chrono::Utc::now().timestamp();
    let kot_number = now_secs % 100_000;
    let ticket_params: Vec<JsValue> = vec![
        ticket_id.clone().into(),
        order_id.clone().into(),
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

    for item in &payload.items {
        let ticket_line: Vec<JsValue> = vec![
            uuid::Uuid::now_v7().to_string().into(),
            ticket_id.clone().into(),
            uuid::Uuid::now_v7().to_string().into(),
            item.menu_item_id.clone().into(),
            item.name.clone().into(),
            item.quantity.into(),
            item.notes.clone().map_or(JsValue::null(), Into::into),
        ];
        db.prepare(
            "INSERT INTO ticket_line_items (id, ticket_id, line_item_id, menu_item_id, name, quantity, special_instructions) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&ticket_line)?
        .run()
        .await?;
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    fn item(name: &str, price: i64, qty: i64) -> PublicOrderItem {
        PublicOrderItem {
            menu_item_id: uuid::Uuid::now_v7().to_string(),
            name: name.to_string(),
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
            items: vec![item("Burger", 20000, 2)],
        }
    }

    #[test]
    fn totals_line_items() {
        assert_eq!(validate(&request()).expect("valid"), 40000);
    }

    #[test]
    fn rejects_bad_tenant_channel_and_items() {
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
