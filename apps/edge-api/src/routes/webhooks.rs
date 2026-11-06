use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac, KeyInit};
use sha2::Sha256;
use worker::{Request, Response, Result, RouteContext, Router, wasm_bindgen::JsValue};

/// Response after accepting a webhook delivery
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct WebhookIngestResponse {
    pub success: bool,
    pub delivery_id: String,
    pub order_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EndpointRow {
    id: String,
    secret: String,
}

#[derive(Debug, Deserialize)]
struct DeliveryRow {
    id: String,
    order_id: Option<String>,
}

/// Registers aggregator webhook ingestion routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/webhooks/swiggy", |req, ctx| ingest(req, ctx, "swiggy"))
        .post_async("/api/v1/webhooks/zomato", |req, ctx| ingest(req, ctx, "zomato"))
        .post_async("/api/v1/webhooks/razorpay", |req, ctx| ingest(req, ctx, "razorpay"))
}

/// Verifies the provided HMAC-SHA256 signature (in hex) against the expected secret and raw body.
#[must_use]
pub fn verify_signature(signature_hex: Option<&str>, secret: &str, raw_body: &str) -> bool {
    let Some(hex_str) = signature_hex else {
        return false;
    };
    let Ok(sig_bytes) = hex::decode(hex_str) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(raw_body.as_bytes());
    mac.verify_slice(&sig_bytes).is_ok()
}

/// Validates that a Razorpay webhook payload contains a string `event` field.
#[must_use]
pub fn is_valid_razorpay_payload(payload: &serde_json::Value) -> bool {
    payload
        .get("event")
        .and_then(|v| v.as_str())
        .is_some()
}

/// Ingests an aggregator webhook delivery.
///
/// Flow: tenant header required, body must be valid JSON, endpoint secret
/// must match, delivery recorded, 202 accepted. Swiggy and Zomato deliveries
/// also materialize a POS order plus kitchen ticket; a replay carrying an
/// already-seen idempotency key returns the original ids with 200.
///
/// # Errors
/// Returns an error if request reading or database access fails
#[allow(clippy::too_many_lines)]
pub async fn ingest<D>(mut req: Request, ctx: RouteContext<D>, provider: &str) -> Result<Response> {
    let tenant_id = match req.headers().get("x-tenant-id").ok().flatten() {
        Some(id) if !id.is_empty() => id,
        _ => return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401),
    };

    let Ok(raw) = req.text().await else {
        return crate::router::json_error("Invalid payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };
    let Ok(payload) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    if provider == "razorpay" && !is_valid_razorpay_payload(&payload) {
        return crate::router::json_error("Invalid Razorpay payload shape", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let tenant_param: JsValue = tenant_id.clone().into();
    let endpoint = db
        .prepare("SELECT id, secret FROM webhook_endpoints WHERE tenant_id = ?1 AND is_active = 1 LIMIT 1")
        .bind(&[tenant_param])?
        .first::<EndpointRow>(None)
        .await?;
    let Some(endpoint) = endpoint else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let provided_sig = req.headers().get("x-webhook-signature").ok().flatten();
    let accepted = verify_signature(provided_sig.as_deref(), &endpoint.secret, &raw);

    if !accepted {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    }

    let idempotency_key = req.headers().get("x-idempotency-key").ok().flatten();
    let Some(idempotency_key) = idempotency_key else {
        return crate::router::json_error("Missing x-idempotency-key header", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let existing = db
        .prepare("SELECT id, order_id FROM webhook_deliveries WHERE endpoint_id = ?1 AND idempotency_key = ?2 LIMIT 1")
        .bind(&[endpoint.id.clone().into(), idempotency_key.clone().into()])?
        .first::<DeliveryRow>(None)
        .await?;

    if let Some(row) = existing {
        let mut resp = Response::from_json(&WebhookIngestResponse {
            success: true,
            delivery_id: row.id,
            order_id: row.order_id,
        })?;
        resp = resp.with_status(200);
        return Ok(resp);
    }

    let mut order_id: Option<String> = None;
    let mut batch = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();

    let config = crate::config::BusinessConfig::from_env(&ctx.env);
    let mut aggregator_name: Option<String> = None;
    for allowed in &config.aggregator_allowlist {
        if allowed.to_lowercase() == *provider {
            aggregator_name = Some(allowed.clone());
            break;
        }
    }

    if let Some(channel) = aggregator_name {
        let Some(location_id) = req.headers().get("x-location-id").ok().flatten().filter(|id| !id.is_empty()) else {
            return crate::router::json_error("Missing x-location-id header", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
        };

        let oid = uuid::Uuid::now_v7().to_string();
        order_id = Some(oid.clone());

        let stmt_order = db.prepare(
            "INSERT INTO orders (id, tenant_id, location_id, terminal_id, channel, status, subtotal_minor, total_minor, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(&[
            oid.clone().into(),
            tenant_id.clone().into(),
            location_id.clone().into(),
            "webhook".into(),
            channel.into(),
            "Confirmed".into(),
            crate::db::money(0),
            crate::db::money(0),
            "webhook".into(),
            now.clone().into(),
            now.clone().into(),
        ])?;
        batch.push(stmt_order);

        let ticket_id = uuid::Uuid::now_v7().to_string();
        let now_secs = chrono::Utc::now().timestamp();
        let kot_number = now_secs % 100_000;

        let stmt_ticket = db.prepare(
            "INSERT INTO kitchen_tickets (id, order_id, tenant_id, location_id, station, kot_number, status, sla_warning_sec, sla_late_sec, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(&[
            ticket_id.into(),
            oid.clone().into(),
            tenant_id.into(),
            location_id.into(),
            "MainKitchen".into(),
            crate::db::money(kot_number),
            "Pending".into(),
            crate::db::money(i64::from(config.kitchen_sla_warning_minutes)),
            crate::db::money(i64::from(config.kitchen_sla_late_minutes)),
            now.clone().into(),
        ])?;
        batch.push(stmt_ticket);
    }

    let delivery_id = uuid::Uuid::now_v7().to_string();
    let params: Vec<JsValue> = vec![
        delivery_id.clone().into(),
        endpoint.id.into(),
        raw.into(),
        "received".into(),
        crate::db::money(202),
        now.into(),
        idempotency_key.into(),
        order_id.clone().map_or(JsValue::null(), Into::into),
    ];

    let stmt_delivery = db
        .prepare("INSERT INTO webhook_deliveries (id, endpoint_id, payload_json, status, response_code, delivered_at, idempotency_key, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&params)?;
    batch.push(stmt_delivery);

    if let Err(e) = db.batch(batch).await {
        return crate::router::json_error(format!("Database error: {e:?}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    }

    let mut resp = Response::from_json(&WebhookIngestResponse {
        success: true,
        delivery_id,
        order_id,
    })?;
    resp = resp.with_status(202);
    Ok(resp)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_must_match_exactly() {
        let secret = "s3cret";
        let body = "hello world";
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body.as_bytes());
        let valid_hex = hex::encode(mac.finalize().into_bytes());

        assert!(verify_signature(Some(&valid_hex), secret, body));
        assert!(!verify_signature(Some("wrong"), secret, body));
        assert!(!verify_signature(None, secret, body));
        assert!(!verify_signature(Some(""), secret, body));
    }

    #[test]
    fn response_shape_serializes() {
        let res = WebhookIngestResponse {
            success: true,
            delivery_id: "d-1".to_string(),
            order_id: None,
        };
        let json = serde_json::to_string(&res).unwrap();
        assert!(json.contains("d-1"));
    }

    #[test]
    fn razorpay_payload_validation() {
        let valid_json = serde_json::json!({
            "event": "payment.captured",
            "payload": {}
        });
        assert!(is_valid_razorpay_payload(&valid_json));

        let missing_event = serde_json::json!({
            "not_event": "something"
        });
        assert!(!is_valid_razorpay_payload(&missing_event));

        let numeric_event = serde_json::json!({
            "event": 12345
        });
        assert!(!is_valid_razorpay_payload(&numeric_event));

        let null_event = serde_json::json!({
            "event": null
        });
        assert!(!is_valid_razorpay_payload(&null_event));
    }
}
