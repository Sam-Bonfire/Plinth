use core_domain::{
    enums::{refund::RefundStatus, staff::Permissions},
    ids::AuditEventId,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{wasm_bindgen::JsValue, D1Database, Request, Response, Result, RouteContext, Router};
use chrono::Utc;

/// Request payload to record a refund
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RefundRequest {
    pub order_id: String,
    pub amount_minor: i64,
    pub reason: String,
}

/// Response for a refund request or lifecycle step
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RefundResponse {
    pub refund_id: String,
    pub status: String,
}

/// Validates a refund payload.
///
/// # Errors
/// Returns a message if the order ID or reason is blank, or the amount is not positive.
pub fn validate_refund(payload: &RefundRequest) -> std::result::Result<(), &'static str> {
    if payload.order_id.trim().is_empty() {
        return Err("Order ID cannot be empty");
    }
    if payload.amount_minor <= 0 {
        return Err("Refund amount must be positive");
    }
    if payload.reason.trim().is_empty() {
        return Err("Refund reason cannot be empty");
    }
    Ok(())
}

/// Rejects a refund that is larger than the order total.
///
/// # Errors
/// Returns a message naming both amounts when the refund exceeds the order total.
pub fn validate_refund_amount(
    amount_minor: i64,
    order_total_minor: i64,
) -> std::result::Result<(), String> {
    if amount_minor > order_total_minor {
        return Err(format!(
            "Refund amount {amount_minor} exceeds the order total {order_total_minor}"
        ));
    }
    Ok(())
}

/// Stored label for a refund status.
const fn status_label(status: RefundStatus) -> &'static str {
    match status {
        RefundStatus::Pending => "Pending",
        RefundStatus::Approved => "Approved",
        RefundStatus::Processed => "Processed",
        RefundStatus::Rejected => "Rejected",
    }
}

/// Maps a stored refund status onto the domain enum.
#[must_use]
pub fn parse_refund_status(raw: &str) -> Option<RefundStatus> {
    match raw {
        "Pending" => Some(RefundStatus::Pending),
        "Approved" => Some(RefundStatus::Approved),
        "Processed" | "Completed" => Some(RefundStatus::Processed),
        "Rejected" => Some(RefundStatus::Rejected),
        _ => None,
    }
}

/// One lifecycle step a manager can take on a pending refund.
#[derive(Debug, Clone, Copy)]
enum RefundStep {
    Approve,
    Process,
}

impl RefundStep {
    const fn target(self) -> RefundStatus {
        match self {
            Self::Approve => RefundStatus::Approved,
            Self::Process => RefundStatus::Processed,
        }
    }

    const fn rejection(self) -> &'static str {
        match self {
            Self::Approve => "Refund can only be approved while Pending",
            Self::Process => "Refund can only be processed once Approved",
        }
    }
}

#[derive(Debug, Deserialize)]
struct StoredRefundRow {
    amount_minor: i64,
    status: String,
}

/// Registers the refund routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/refunds", record_refund)
        .post_async("/api/v1/refunds/:id/approve", approve_refund)
        .post_async("/api/v1/refunds/:id/process", process_refund)
}

/// Records a refund request against an order; it starts in `Pending`.
///
/// # Errors
/// Returns an error if authentication fails, input is invalid,
/// the order is unknown, the amount exceeds the order total, or the database write fails
pub async fn record_refund<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::PROCESS_REFUND) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let payload: RefundRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &request_id, 400),
    };

    if let Err(msg) = validate_refund(&payload) {
        return crate::router::json_error(msg, "INVALID_PAYLOAD", &request_id, 400);
    }

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    let order = db
        .prepare("SELECT total_minor FROM orders WHERE id = ? AND tenant_id = ?")
        .bind(&[payload.order_id.clone().into(), tenant_ctx.tenant_id.to_string().into()])?
        .first::<serde_json::Value>(None)
        .await?;
    let Some(order) = order else {
        return crate::router::json_error("Order not found", "NOT_FOUND", &request_id, 404);
    };
    let order_total_minor = order
        .get("total_minor")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);

    if let Err(msg) = validate_refund_amount(payload.amount_minor, order_total_minor) {
        return crate::router::json_error(msg, "INVALID_PAYLOAD", &request_id, 400);
    }

    let refund_id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    let stmt = db
        .prepare("INSERT INTO refunds (id, tenant_id, location_id, order_id, refund_type, reason, amount_minor, currency, status, authorized_by, created_at, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&[
            refund_id.clone().into(),
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
            payload.order_id.clone().into(),
            "full".into(),
            payload.reason.trim().to_string().into(),
            crate::db::money(payload.amount_minor),
            "Inr".into(),
            status_label(RefundStatus::Pending).into(),
            tenant_ctx.staff_id.to_string().into(),
            now.into(),
            JsValue::null(),
        ])?;
    stmt.run().await?;

    let body = RefundResponse {
        refund_id,
        status: status_label(RefundStatus::Pending).to_string(),
    };
    Response::from_json(&body).map(|r| r.with_status(201))
}

/// Approves a pending refund (`Pending` → `Approved`).
///
/// # Errors
/// Returns 404 for unknown refunds and 409 when the refund is not `Pending`
pub async fn approve_refund<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    advance_refund(req, ctx, RefundStep::Approve).await
}

/// Processes an approved refund (`Approved` → `Processed`) and logs the gateway call.
///
/// # Errors
/// Returns 404 for unknown refunds and 409 when the refund is not `Approved`
pub async fn process_refund<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    advance_refund(req, ctx, RefundStep::Process).await
}

/// Applies one refund lifecycle step, refusing illegal skips.
async fn advance_refund<D>(
    req: Request,
    ctx: RouteContext<D>,
    step: RefundStep,
) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::PROCESS_REFUND) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Some(refund_id) = ctx.param("id") else {
        return crate::router::json_error("Missing refund ID", "INVALID_PAYLOAD", &request_id, 400);
    };
    let refund_id = refund_id.clone();

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    let row = db
        .prepare("SELECT amount_minor, status FROM refunds WHERE id = ? AND tenant_id = ? AND location_id = ?")
        .bind(&[
            refund_id.clone().into(),
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
        ])?
        .first::<StoredRefundRow>(None)
        .await?;
    let Some(row) = row else {
        return crate::router::json_error("Refund not found", "NOT_FOUND", &request_id, 404);
    };

    let Some(status) = parse_refund_status(&row.status) else {
        return crate::router::json_error(
            format!("Refund has an unknown status '{}'", row.status),
            "INVALID_DATA",
            &request_id,
            500,
        );
    };

    let target = step.target();
    if !status.can_transition_to(&target) {
        return crate::router::json_error(step.rejection(), "CONFLICT", &request_id, 409);
    }

    let processed_at = (matches!(step, RefundStep::Process)).then(|| Utc::now().to_rfc3339());
    let update = db
        .prepare("UPDATE refunds SET status = ?, processed_at = ? WHERE id = ? AND tenant_id = ? AND location_id = ?")
        .bind(&[
            status_label(target).into(),
            processed_at.clone().map_or(JsValue::null(), Into::into),
            refund_id.clone().into(),
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
        ])?;
    update.run().await?;

    if matches!(step, RefundStep::Process) {
        log_gateway_stub(
            &db,
            &refund_id,
            row.amount_minor,
            tenant_ctx.tenant_id,
            tenant_ctx.location_id,
            tenant_ctx.staff_id,
        )
        .await?;
    }

    let body = RefundResponse {
        refund_id,
        status: status_label(target).to_string(),
    };
    Response::from_json(&body)
}

/// Records the gateway call the refund would make.
///
/// shortcut: no payment provider is wired yet; this audit row is the only
/// trace of the outbound refund until a gateway client lands.
async fn log_gateway_stub(
    db: &D1Database,
    refund_id: &str,
    amount_minor: i64,
    tenant_id: core_domain::ids::TenantId,
    location_id: core_domain::ids::LocationId,
    staff_id: core_domain::ids::StaffMemberId,
) -> Result<()> {
    let payload = serde_json::json!({
        "gateway": "stub",
        "operation": "refund",
        "amount_minor": amount_minor,
    })
    .to_string();

    let stmt = db
        .prepare("INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&[
            AuditEventId::new().to_string().into(),
            tenant_id.to_string().into(),
            location_id.to_string().into(),
            staff_id.to_string().into(),
            "REFUND_GATEWAY_STUB".into(),
            "refund".into(),
            refund_id.into(),
            payload.into(),
            0.into(),
            Utc::now().to_rfc3339().into(),
        ])?;
    stmt.run().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req() -> RefundRequest {
        RefundRequest {
            order_id: "o-1".to_string(),
            amount_minor: 500,
            reason: "Cold food".to_string(),
        }
    }

    #[test]
    fn accepts_valid_refund() {
        assert_eq!(validate_refund(&req()), Ok(()));
    }

    #[test]
    fn rejects_blank_order_bad_amount_and_reason() {
        assert_eq!(
            validate_refund(&RefundRequest { order_id: "  ".to_string(), ..req() }),
            Err("Order ID cannot be empty")
        );
        assert_eq!(
            validate_refund(&RefundRequest { amount_minor: 0, ..req() }),
            Err("Refund amount must be positive")
        );
        assert_eq!(
            validate_refund(&RefundRequest { reason: String::new(), ..req() }),
            Err("Refund reason cannot be empty")
        );
    }

    #[test]
    fn caps_refund_at_order_total() {
        assert_eq!(validate_refund_amount(500, 500), Ok(()));
        assert_eq!(validate_refund_amount(499, 500), Ok(()));
        assert!(validate_refund_amount(501, 500).is_err());
    }

    #[test]
    fn lifecycle_rejects_illegal_skips() {
        assert!(parse_refund_status("Pending").unwrap().can_transition_to(&RefundStep::Approve.target()));
        assert!(parse_refund_status("Approved").unwrap().can_transition_to(&RefundStep::Process.target()));
        // Processing before approval is the illegal skip the route answers 409 for.
        assert!(!parse_refund_status("Pending").unwrap().can_transition_to(&RefundStep::Process.target()));
        assert!(!parse_refund_status("Processed").unwrap().can_transition_to(&RefundStep::Approve.target()));
        assert!(parse_refund_status("Completed").is_some());
        assert!(parse_refund_status("Bogus").is_none());
    }
}
