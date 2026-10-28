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

/// Audit actions the edge accepts, each with the permission it implies.
///
/// The trail is tamper-evident, so an arbitrary action string from any logged-in
/// caller would let the watched pollute their own record.
const AUDIT_ACTIONS: &[(&str, Permissions)] = &[
    ("TENDER_CASH", Permissions::TAKE_ORDER),
    ("TENDER_UPI", Permissions::TAKE_ORDER),
    ("TENDER_CARD", Permissions::TAKE_ORDER),
    ("TENDER_WALLET", Permissions::TAKE_ORDER),
    ("APPLY_DISCOUNT", Permissions::APPLY_DISCOUNT),
    ("VOID_ORDER", Permissions::VOID_ORDER),
    ("PROCESS_REFUND", Permissions::PROCESS_REFUND),
    ("PRICE_OVERRIDE", Permissions::MODIFY_PRICE),
    ("OPEN_SHIFT", Permissions::OPEN_CLOSE_SHIFT),
    ("CLOSE_SHIFT", Permissions::OPEN_CLOSE_SHIFT),
    ("MESS_TOPUP", Permissions::MANAGE_MESS),
    ("PO_RECEIVE", Permissions::MANAGE_INVENTORY),
    ("ROLE_MATRIX_SYNC", Permissions::MANAGE_STAFF),
];

/// Permission an audit action requires, or `None` when it is not allowlisted.
#[must_use]
pub fn required_permission(action: &str) -> Option<Permissions> {
    AUDIT_ACTIONS
        .iter()
        .find(|(name, _)| *name == action)
        .map(|(_, permission)| *permission)
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
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::empty(),
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Ok(payload) = req.json::<IngestAuditRequest>().await else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let Some(required) = required_permission(&payload.action) else {
        return crate::router::json_error("Audit action not allowed", "AUDIT_ACTION_NOT_ALLOWED", &crate::router::get_request_id(&req), 403);
    };
    if !tenant_ctx.permissions.contains(required) {
        return crate::router::json_error("Insufficient permissions", "FORBIDDEN", &crate::router::get_request_id(&req), 403);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    let audit_id = AuditEventId::new();
    // D1 binds reject BigInt: ship small integers as f64 like staff permissions.
    let is_anomaly_num = f64::from(payload.is_anomaly.unwrap_or(false));
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
        is_anomaly_num.into(),
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
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::empty(),
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let limit: f64 = req
        .url()
        .ok()
        .and_then(|u| {
            u.query_pairs()
                .find(|(k, _)| k == "limit")
                .and_then(|(_, v)| v.parse::<i32>().ok())
        })
        .filter(|n| (1..=200).contains(n))
        .map_or(50.0, f64::from);

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
    fn test_required_permission_maps_known_actions() {
        assert_eq!(required_permission("VOID_ORDER"), Some(Permissions::VOID_ORDER));
        assert_eq!(required_permission("TENDER_UPI"), Some(Permissions::TAKE_ORDER));
        assert_eq!(required_permission("ROLE_MATRIX_SYNC"), Some(Permissions::MANAGE_STAFF));
    }

    #[test]
    fn test_required_permission_rejects_unknown_action() {
        assert_eq!(required_permission("SOMETHING_INVENTED"), None);
        assert_eq!(required_permission(""), None);
        assert_eq!(required_permission("void_order"), None);
    }

    #[test]
    fn test_cashier_cannot_claim_a_manager_action() {
        let cashier = core_domain::enums::staff::StaffRole::Cashier.default_permissions();
        assert!(cashier.contains(required_permission("TENDER_CASH").unwrap()));
        assert!(!cashier.contains(required_permission("ROLE_MATRIX_SYNC").unwrap()));
        assert!(!cashier.contains(required_permission("VOID_ORDER").unwrap()));
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
