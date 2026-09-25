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

/// One audit log event as stored
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AuditEventDto {
    pub id: String,
    pub actor_id: String,
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub is_anomaly: bool,
    pub timestamp: String,
}

/// Page of audit log events
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AuditListResponse {
    pub events: Vec<AuditEventDto>,
}

/// Maps a D1 result row to an audit event DTO.
#[must_use]
pub fn parse_audit_row(v: &serde_json::Value) -> Option<AuditEventDto> {
    Some(AuditEventDto {
        id: v.get("id")?.as_str()?.to_string(),
        actor_id: v.get("actor_id")?.as_str()?.to_string(),
        action: v.get("action")?.as_str()?.to_string(),
        target_type: v.get("target_type")?.as_str()?.to_string(),
        target_id: v.get("target_id")?.as_str()?.to_string(),
        is_anomaly: v.get("is_anomaly")?.as_i64().unwrap_or(0) != 0,
        timestamp: v.get("timestamp")?.as_str()?.to_string(),
    })
}

/// Registers the Audit routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/audit", ingest_audit)
        .get_async("/api/v1/audit", list_audit)
}

/// Ingests a new audit log entry
///
/// # Errors
/// Returns an error if authentication fails, input is invalid, or database write fails
pub async fn ingest_audit<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let Ok(payload) = req.json::<IngestAuditRequest>().await else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
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

/// Lists recent audit log events for the tenant, newest first.
///
/// # Errors
/// Returns an error if authentication fails or the database read fails.
pub async fn list_audit<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let limit: i64 = req
        .url()
        .ok()
        .and_then(|u| {
            u.query_pairs()
                .find(|(k, _)| k == "limit")
                .and_then(|(_, v)| v.parse::<i64>().ok())
        })
        .filter(|n| (1..=200).contains(n))
        .unwrap_or(50);

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    let stmt = db
        .prepare("SELECT id, actor_id, action, target_type, target_id, is_anomaly, timestamp FROM audit_events WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?")
        .bind(&[tenant_ctx.tenant_id.to_string().into(), limit.into()])?;
    let rows = stmt.all().await?.results::<serde_json::Value>()?;
    let events: Vec<AuditEventDto> = rows.iter().filter_map(parse_audit_row).collect();

    Response::from_json(&AuditListResponse { events })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_audit_row_maps_fields() {
        let v = serde_json::json!({
            "id": "e-1",
            "actor_id": "s-1",
            "action": "VOID",
            "target_type": "Order",
            "target_id": "o-1",
            "is_anomaly": 1,
            "timestamp": "2026-01-01T00:00:00Z"
        });
        let dto = parse_audit_row(&v).expect("valid row");
        assert_eq!(dto.id, "e-1");
        assert!(dto.is_anomaly);
    }

    #[test]
    fn test_parse_audit_row_rejects_incomplete() {
        let v = serde_json::json!({ "id": "e-1" });
        assert!(parse_audit_row(&v).is_none());
    }

    #[test]
    fn test_ingest_audit_request_serde() {        let req = IngestAuditRequest {
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
