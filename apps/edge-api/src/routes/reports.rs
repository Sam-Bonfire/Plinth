use core_domain::{
    enums::staff::Permissions,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

/// Response containing sales analytics and KPIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReportDto {
    pub total_revenue_minor: i64,
    pub total_orders: u32,
    pub hourly_volume: HashMap<u32, u32>,
    pub payment_distribution: HashMap<String, f64>,
    pub tax_liability_minor: i64,
}

#[derive(Debug, Deserialize)]
struct SettledOrderSummaryRow {
    grand_total_minor: i64,
    tax_minor: i64,
    payment_method: String,
    created_at: String,
}

/// Registers the Sales Analytics Report endpoint
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/api/v1/reports/sales", get_sales_report)
}

/// Retrieves sales performance metrics for a specified period
///
/// # Errors
/// Returns an error if authentication fails or query execution fails
pub async fn get_sales_report<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        "",
        Permissions::ACCESS_REPORTS,
    ) else {
        return Response::error("Forbidden: Insufficient permissions to view reports", 403);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let url = req.url()?;
    let query_params: HashMap<String, String> = url.query_pairs().into_owned().collect();
    let period = query_params.get("period").map(String::as_str);

    let (date_from, date_to) = match period {
        Some("today") => {
            let start = chrono::Utc::now()
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .unwrap_or_default()
                .and_utc();
            (Some(start.to_rfc3339()), None)
        }
        Some("yesterday") => {
            let yesterday = (chrono::Utc::now() - chrono::Duration::days(1)).date_naive();
            let start = yesterday.and_hms_opt(0, 0, 0).unwrap_or_default().and_utc();
            let end = yesterday.and_hms_opt(23, 59, 59).unwrap_or_default().and_utc();
            (Some(start.to_rfc3339()), Some(end.to_rfc3339()))
        }
        _ => (
            query_params.get("date_from").cloned(),
            query_params.get("date_to").cloned(),
        ),
    };

    let mut query = String::from(
        "SELECT (subtotal_minor + tax_minor + charges_minor - discounts_minor) as grand_total_minor, tax_minor, payment_method, created_at FROM orders WHERE tenant_id = ? AND location_id = ? AND status = 'Settled'"
    );

    let mut params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    if let Some(ref from) = date_from {
        query.push_str(" AND created_at >= ?");
        params.push(from.clone().into());
    }

    if let Some(ref to) = date_to {
        query.push_str(" AND created_at <= ?");
        params.push(to.clone().into());
    }

    let stmt = db.prepare(&query).bind(&params)?;
    let res = stmt.all().await?;
    let orders: Vec<SettledOrderSummaryRow> = res.results()?;

    let mut total_revenue_minor: i64 = 0;
    let mut tax_liability_minor: i64 = 0;
    let mut hourly_volume: HashMap<u32, u32> = HashMap::new();
    let mut payment_counts: HashMap<String, u32> = HashMap::new();
    let total_orders = u32::try_from(orders.len()).unwrap_or(0);

    for order in orders {
        total_revenue_minor += order.grand_total_minor;
        tax_liability_minor += order.tax_minor;

        if let Ok(parsed_time) = chrono::DateTime::parse_from_rfc3339(&order.created_at) {
            use chrono::Timelike;
            let hour = parsed_time.hour();
            *hourly_volume.entry(hour).or_insert(0) += 1;
        }

        if !order.payment_method.is_empty() {
            *payment_counts.entry(order.payment_method).or_insert(0) += 1;
        }
    }

    let mut payment_distribution = HashMap::new();
    let total_payments: u32 = payment_counts.values().sum();
    if total_payments > 0 {
        for (method, count) in payment_counts {
            let percentage = (f64::from(count) / f64::from(total_payments)) * 100.0;
            payment_distribution.insert(method, percentage);
        }
    }

    let report_dto = SalesReportDto {
        total_revenue_minor,
        total_orders,
        hourly_volume,
        payment_distribution,
        tax_liability_minor,
    };

    Response::from_json(&report_dto)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sales_report_dto_serialization() {
        let mut hourly = HashMap::new();
        hourly.insert(12, 14);
        hourly.insert(13, 25);

        let mut distribution = HashMap::new();
        distribution.insert("UPI".to_string(), 65.0);
        distribution.insert("Card".to_string(), 35.0);

        let dto = SalesReportDto {
            total_revenue_minor: 450_000,
            total_orders: 39,
            hourly_volume: hourly,
            payment_distribution: distribution,
            tax_liability_minor: 22_500,
        };

        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("450000"));
        assert!(json.contains("UPI"));
    }
}
