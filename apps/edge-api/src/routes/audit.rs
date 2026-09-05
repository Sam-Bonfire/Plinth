use core_domain::{
    enums::staff::Permissions,
    ids::AuditEventId,
};
use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

/// Request payload to ingest an audit log event
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct IngestAuditRequest {
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub payload_json: Option<String>,
    pub is_anomaly: Option<bool>,
}

/// Response after successfully recording an audit event
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AuditResponseDto {
    pub success: bool,
    pub event_id: AuditEventId,
}

/// Registers the Audit Ingestion route
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/audit", ingest_audit)
}

/// Ingests a new audit log entry
///
/// # Errors
/// Returns an error if authentication fails, input is invalid, or database write fails
pub async fn ingest_audit<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
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

    let Ok(payload) = req.json::<IngestAuditRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let audit_id = AuditEventId::new();
    let is_anomaly_int = i64::from(payload.is_anomaly.unwrap_or(false));
    let now = chrono::Utc::now().to_rfc3339();

    let sql = "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let params: Vec<JsValue> = vec![
        audit_id.to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
        tenant_ctx.staff_id.to_string().into(),
        payload.action.into(),
        payload.target_type.into(),
        payload.target_id.into(),
        payload.payload_json.map_or(JsValue::null(), std::convert::Into::into),
        is_anomaly_int.into(),
        now.into(),
    ];

    let stmt = db.prepare(sql).bind(&params)?;
    let _ = stmt.run().await?;

    let res_dto = AuditResponseDto {
        success: true,
        event_id: audit_id,
    };

    Response::from_json(&res_dto)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ingest_audit_request_serde() {
        let req = IngestAuditRequest {
            action: "MANAGER_OVERRIDE_PRICE".to_string(),
            target_type: "OrderLineItem".to_string(),
            target_id: "item-123".to_string(),
            payload_json: Some("{\"old_price\":500,\"new_price\":400}".to_string()),
            is_anomaly: Some(true),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("MANAGER_OVERRIDE_PRICE"));
        assert!(json.contains("OrderLineItem"));
    }
}
