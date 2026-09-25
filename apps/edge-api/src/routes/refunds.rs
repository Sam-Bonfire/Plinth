use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{Request, Response, Result, RouteContext, Router};
use chrono::Utc;

/// Request payload to record a refund
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RefundRequest {
    pub order_id: String,
    pub amount_minor: i64,
    pub reason: String,
}

/// Response after recording a refund
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RefundResponse {
    pub refund_id: String,
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

/// Registers the refund routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/refunds", record_refund)
}

/// Records a refund against an order
///
/// # Errors
/// Returns an error if authentication fails, input is invalid,
/// the order is unknown, or the database write fails
pub async fn record_refund<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
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

    let check = db
        .prepare("SELECT id FROM orders WHERE id = ? AND tenant_id = ?")
        .bind(&[payload.order_id.clone().into(), tenant_ctx.tenant_id.to_string().into()])?;
    if check
        .first::<serde_json::Value>(None)
        .await?
        .is_none()
    {
        return crate::router::json_error("Order not found", "NOT_FOUND", &request_id, 404);
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
            payload.amount_minor.into(),
            "Inr".into(),
            "Completed".into(),
            tenant_ctx.staff_id.to_string().into(),
            now.clone().into(),
            now.into(),
        ])?;
    stmt.run().await?;

    Response::from_json(&RefundResponse { refund_id }).map(|r| r.with_status(201))
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
}
