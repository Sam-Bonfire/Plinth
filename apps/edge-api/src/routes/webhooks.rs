use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router, wasm_bindgen::JsValue};

/// Response after accepting a webhook delivery
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct WebhookIngestResponse {
    pub success: bool,
    pub delivery_id: String,
}

#[derive(Debug, Deserialize)]
struct EndpointRow {
    id: String,
    secret: String,
}

/// Registers aggregator webhook ingestion routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/webhooks/swiggy", |req, ctx| ingest(req, ctx, "swiggy"))
        .post_async("/api/v1/webhooks/zomato", |req, ctx| ingest(req, ctx, "zomato"))
}

/// Compares the provided secret against the endpoint secret.
#[must_use]
pub fn verify_secret(provided: Option<&str>, expected: &str) -> bool {
    match provided {
        Some(given) => given == expected,
        None => false,
    }
}

/// Ingests an aggregator webhook delivery.
///
/// Flow: tenant header required, body must be valid JSON, endpoint secret
/// must match, delivery recorded, 202 accepted. Order materialization from
/// deliveries is a separate task; this endpoint only captures.
///
/// # Errors
/// Returns an error if request reading or database access fails
pub async fn ingest<D>(mut req: Request, ctx: RouteContext<D>, _provider: &str) -> Result<Response> {
    let tenant_id = match req.headers().get("x-tenant-id").ok().flatten() {
        Some(id) if !id.is_empty() => id,
        _ => return Response::error("Unauthorized", 401),
    };

    let Ok(raw) = req.text().await else {
        return Response::error("Invalid payload", 400);
    };
    if serde_json::from_str::<serde_json::Value>(&raw).is_err() {
        return Response::error("Invalid JSON payload", 400);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let tenant_param: JsValue = tenant_id.into();
    let endpoint = db
        .prepare("SELECT id, secret FROM webhook_endpoints WHERE tenant_id = ?1 AND is_active = 1 LIMIT 1")
        .bind(&[tenant_param])?
        .first::<EndpointRow>(None)
        .await?;
    let Some(endpoint) = endpoint else {
        return Response::error("Unauthorized", 401);
    };

    let provided = req.headers().get("x-webhook-secret").ok().flatten();
    let accepted = verify_secret(provided.as_deref(), &endpoint.secret);
    let status = if accepted { "received" } else { "rejected" };
    let code: i64 = if accepted { 202 } else { 401 };
    let delivery_id = uuid::Uuid::now_v7().to_string();
    let params: Vec<JsValue> = vec![
        delivery_id.clone().into(),
        endpoint.id.into(),
        raw.into(),
        status.into(),
        code.into(),
        chrono::Utc::now().to_rfc3339().into(),
    ];
    let stmt = db
        .prepare("INSERT INTO webhook_deliveries (id, endpoint_id, payload_json, status, response_code, delivered_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&params)?;
    let _ = stmt.run().await?;

    if !accepted {
        return Response::error("Unauthorized", 401);
    }

    let mut resp = Response::from_json(&WebhookIngestResponse {
        success: true,
        delivery_id,
    })?;
    resp = resp.with_status(202);
    Ok(resp)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_must_match_exactly() {
        assert!(verify_secret(Some("s3cret"), "s3cret"));
        assert!(!verify_secret(Some("wrong"), "s3cret"));
        assert!(!verify_secret(None, "s3cret"));
        assert!(!verify_secret(Some(""), "s3cret"));
    }

    #[test]
    fn response_shape_serializes() {
        let res = WebhookIngestResponse {
            success: true,
            delivery_id: "d-1".to_string(),
        };
        let json = serde_json::to_string(&res).unwrap();
        assert!(json.contains("d-1"));
    }
}
