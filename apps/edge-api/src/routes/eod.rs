use core_domain::{
    enums::staff::Permissions,
    ids::{AuditEventId, ShiftId},
};
use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

/// Request payload to close a shift
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseShiftRequest {
    pub shift_id: ShiftId,
    pub physical_cash_minor: i64,
    pub notes: Option<String>,
}

/// Z-Report Response DTO returned upon closing a shift
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZReportDto {
    pub shift_id: ShiftId,
    pub gross_sales: i64,
    pub net_sales: i64,
    pub total_tax: i64,
    pub total_discounts: i64,
    pub total_charges: i64,
    pub tender_breakdown: Vec<(String, i64)>,
    pub physical_cash: i64,
    pub expected_cash: i64,
    pub variance: i64,
    pub closed_at: String,
}

#[derive(Debug, Deserialize)]
struct ActiveOrderCountRow {
    count: i64,
}

#[derive(Debug, Deserialize)]
struct ShiftRow {
    opened_at: String,
    opening_float_minor: i64,
    is_closed: i64,
}

#[allow(clippy::struct_field_names)]
#[derive(Debug, Deserialize)]
struct OrderTotalsRow {
    gross_sales_minor: Option<i64>,
    tax_minor: Option<i64>,
    discount_minor: Option<i64>,
    charge_minor: Option<i64>,
    cash_payments_minor: Option<i64>,
    upi_payments_minor: Option<i64>,
    card_payments_minor: Option<i64>,
    wallet_payments_minor: Option<i64>,
}

/// Registers the End of Day Shift Closure endpoint
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/eod/close", close_shift)
}

/// Closes an active store shift and generates the Z-Report
///
/// # Errors
/// Returns an error if active orders remain, shift is invalid/closed, or database error occurs
#[allow(clippy::too_many_lines)]
pub async fn close_shift<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        "",
        Permissions::OPEN_CLOSE_SHIFT,
    ) else {
        return Response::error("Forbidden: Insufficient permissions to close shift", 403);
    };

    let Ok(payload) = req.json::<CloseShiftRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    // 1. Verify no active open orders exist for this location
    let active_orders_query = "SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND location_id = ? AND status IN ('Draft', 'Confirmed', 'Preparing', 'Ready', 'Served')";
    let active_params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];
    let active_stmt = db.prepare(active_orders_query).bind(&active_params)?;
    let active_res = active_stmt.all().await?;
    let active_rows: Vec<ActiveOrderCountRow> = active_res.results()?;
    let active_count = active_rows.first().map_or(0, |r| r.count);

    if active_count > 0 {
        return Response::error(
            format!("Cannot close shift: {active_count} active orders are still open"),
            409,
        );
    }

    // 2. Fetch shift record
    let shift_query = "SELECT opened_at, opening_float_minor, is_closed FROM store_shifts WHERE id = ? AND tenant_id = ? AND location_id = ?";
    let shift_params: Vec<JsValue> = vec![
        payload.shift_id.to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];
    let shift_stmt = db.prepare(shift_query).bind(&shift_params)?;
    let shift_res = shift_stmt.all().await?;
    let shift_rows: Vec<ShiftRow> = shift_res.results()?;

    let Some(shift_record) = shift_rows.into_iter().next() else {
        return Response::error("Shift not found", 404);
    };

    if shift_record.is_closed != 0 {
        return Response::error("Shift is already closed", 400);
    }

    // 3. Aggregate totals for settled orders in shift
    let totals_query = "SELECT
            COALESCE(SUM(subtotal_minor + tax_minor + charges_minor - discounts_minor), 0) as gross_sales_minor,
            COALESCE(SUM(tax_minor), 0) as tax_minor,
            COALESCE(SUM(discounts_minor), 0) as discount_minor,
            COALESCE(SUM(charges_minor), 0) as charge_minor,
            COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total_paid_minor ELSE 0 END), 0) as cash_payments_minor,
            COALESCE(SUM(CASE WHEN payment_method = 'Upi' THEN total_paid_minor ELSE 0 END), 0) as upi_payments_minor,
            COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total_paid_minor ELSE 0 END), 0) as card_payments_minor,
            COALESCE(SUM(CASE WHEN payment_method = 'Wallet' THEN total_paid_minor ELSE 0 END), 0) as wallet_payments_minor
        FROM orders
        WHERE tenant_id = ? AND location_id = ? AND status = 'Settled' AND created_at >= ?";

    let totals_params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
        shift_record.opened_at.clone().into(),
    ];

    let totals_stmt = db.prepare(totals_query).bind(&totals_params)?;
    let totals_res = totals_stmt.all().await?;
    let totals_rows: Vec<OrderTotalsRow> = totals_res.results()?;
    let totals = totals_rows.first();

    let gross_sales = totals.and_then(|t| t.gross_sales_minor).unwrap_or(0);
    let total_tax = totals.and_then(|t| t.tax_minor).unwrap_or(0);
    let total_discounts = totals.and_then(|t| t.discount_minor).unwrap_or(0);
    let total_charges = totals.and_then(|t| t.charge_minor).unwrap_or(0);
    let net_sales = gross_sales - total_tax;

    let cash_payments = totals.and_then(|t| t.cash_payments_minor).unwrap_or(0);
    let upi_payments = totals.and_then(|t| t.upi_payments_minor).unwrap_or(0);
    let card_payments = totals.and_then(|t| t.card_payments_minor).unwrap_or(0);
    let wallet_payments = totals.and_then(|t| t.wallet_payments_minor).unwrap_or(0);

    let expected_cash = shift_record.opening_float_minor + cash_payments;
    let physical_cash = payload.physical_cash_minor;
    let variance = physical_cash - expected_cash;

    let closed_at = chrono::Utc::now().to_rfc3339();

    // 4. Update store_shifts table
    let update_shift_sql = "UPDATE store_shifts SET is_closed = 1, closed_at = ?, closing_cash_minor = ?, expected_cash_minor = ? WHERE id = ? AND tenant_id = ? AND location_id = ?";
    let update_shift_params: Vec<JsValue> = vec![
        closed_at.clone().into(),
        physical_cash.into(),
        expected_cash.into(),
        payload.shift_id.to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];
    let update_stmt = db.prepare(update_shift_sql).bind(&update_shift_params)?;
    let _ = update_stmt.run().await?;

    // 5. Insert audit log event
    let audit_sql = "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let audit_id = AuditEventId::new();
    let is_anomaly_int = i64::from(variance.abs() > 50_000); // flag > ₹500 variance as anomaly
    let audit_payload = serde_json::json!({
        "shift_id": payload.shift_id,
        "physical_cash_minor": physical_cash,
        "expected_cash_minor": expected_cash,
        "variance_minor": variance,
        "notes": payload.notes
    });

    let audit_params: Vec<JsValue> = vec![
        audit_id.to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
        tenant_ctx.staff_id.to_string().into(),
        "SHIFT_CLOSED".into(),
        "StoreShift".into(),
        payload.shift_id.to_string().into(),
        audit_payload.to_string().into(),
        is_anomaly_int.into(),
        closed_at.clone().into(),
    ];
    let audit_stmt = db.prepare(audit_sql).bind(&audit_params)?;
    let _ = audit_stmt.run().await?;

    let z_report = ZReportDto {
        shift_id: payload.shift_id,
        gross_sales,
        net_sales,
        total_tax,
        total_discounts,
        total_charges,
        tender_breakdown: vec![
            ("Cash".to_string(), cash_payments),
            ("UPI".to_string(), upi_payments),
            ("Card".to_string(), card_payments),
            ("Wallet".to_string(), wallet_payments),
        ],
        physical_cash,
        expected_cash,
        variance,
        closed_at,
    };

    Response::from_json(&z_report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_z_report_dto_serialization() {
        let z = ZReportDto {
            shift_id: ShiftId::new(),
            gross_sales: 154_000,
            net_sales: 130_508,
            total_tax: 23_492,
            total_discounts: 5000,
            total_charges: 0,
            tender_breakdown: vec![
                ("Cash".to_string(), 50_000),
                ("UPI".to_string(), 104_000),
            ],
            physical_cash: 52_000,
            expected_cash: 50_000,
            variance: 2000,
            closed_at: chrono::Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string(&z).unwrap();
        assert!(json.contains("154000"));
        assert!(json.contains("variance"));
    }
}
