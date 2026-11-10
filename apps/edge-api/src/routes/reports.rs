use core_domain::{
    enums::staff::Permissions,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GstSlabSummaryDto {
    pub rate: core_domain::value_objects::tax::GstRate,
    #[specta(type = f64)]
    pub rate_percent: f64,
    pub taxable_amount_minor: i64,
    pub tax_amount_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GstReportDto {
    pub slabs: Vec<GstSlabSummaryDto>,
    pub total_tax_minor: i64,
}

#[derive(Debug, Deserialize)]
struct OrderLineRow {
    unit_price_minor: i64,
    quantity: i64,
    tax_rate: String,
}

fn parse_tax_rate(raw: &str) -> Option<core_domain::value_objects::tax::GstRate> {
    match raw {
        "Exempt" | "0" => Some(core_domain::value_objects::tax::GstRate::Exempt),
        "FivePercent" | "5" | "5%" => Some(core_domain::value_objects::tax::GstRate::FivePercent),
        "TwelvePercent" | "12" | "12%" => Some(core_domain::value_objects::tax::GstRate::TwelvePercent),
        "EighteenPercent" | "18" | "18%" => Some(core_domain::value_objects::tax::GstRate::EighteenPercent),
        "TwentyEightPercent" | "28" | "28%" => Some(core_domain::value_objects::tax::GstRate::TwentyEightPercent),
        _ => None,
    }
}

/// Response containing sales analytics and KPIs
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SalesReportDto {
    #[specta(type = f64)]
    pub total_revenue_minor: i64,
    pub total_orders: u32,
    pub hourly_volume: HashMap<u32, u32>,
    pub payment_distribution: HashMap<String, f64>,
    #[specta(type = f64)]
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
        .get_async("/api/v1/reports/gst", get_gst_report)
}

/// Retrieves GST report for a specified period
///
/// # Errors
/// Returns an error if authentication fails or query execution fails
pub async fn get_gst_report<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::ACCESS_REPORTS,
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
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
        "SELECT oli.unit_price_minor, oli.quantity, oli.tax_rate FROM order_line_items oli JOIN orders o ON oli.order_id = o.id WHERE o.tenant_id = ? AND o.location_id = ? AND o.status = 'Settled'"
    );

    let mut params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    if let Some(ref from) = date_from {
        query.push_str(" AND o.created_at >= ?");
        params.push(from.clone().into());
    }

    if let Some(ref to) = date_to {
        query.push_str(" AND o.created_at <= ?");
        params.push(to.clone().into());
    }

    let stmt = db.prepare(&query).bind(&params)?;
    let res = stmt.all().await?;
    let lines: Vec<OrderLineRow> = res.results()?;

    let mut slabs_map = HashMap::new();
    let mut total_tax_minor = 0;

    for line in lines {
        let rate = parse_tax_rate(&line.tax_rate).unwrap_or(core_domain::value_objects::tax::GstRate::Exempt);
        let subtotal_minor = line.unit_price_minor * line.quantity;
        let money = core_domain::value_objects::money::Money::from_minor_units(subtotal_minor, core_domain::value_objects::money::Currency::Inr);

        let breakdown = core_domain::value_objects::tax::compute_gst(&money, &rate, &core_domain::value_objects::tax::GstApplicability::IntraState);
        let tax_minor = breakdown.total_tax.to_minor_units();

        let entry = slabs_map.entry(rate).or_insert((0, 0));
        entry.0 += subtotal_minor;
        entry.1 += tax_minor;

        total_tax_minor += tax_minor;
    }

    let mut slabs = Vec::new();
    for (rate, (taxable, tax)) in slabs_map {
        let rate_percent = match rate {
            core_domain::value_objects::tax::GstRate::FivePercent => 5.0,
            core_domain::value_objects::tax::GstRate::TwelvePercent => 12.0,
            core_domain::value_objects::tax::GstRate::EighteenPercent => 18.0,
            core_domain::value_objects::tax::GstRate::TwentyEightPercent => 28.0,
            _ => 0.0,
        };
        slabs.push(GstSlabSummaryDto {
            rate,
            rate_percent,
            taxable_amount_minor: taxable,
            tax_amount_minor: tax,
        });
    }

    slabs.sort_by(|a, b| a.rate_percent.partial_cmp(&b.rate_percent).unwrap_or(std::cmp::Ordering::Equal));

    Response::from_json(&GstReportDto {
        slabs,
        total_tax_minor,
    })
}


/// Retrieves sales performance metrics for a specified period
///
/// # Errors
/// Returns an error if authentication fails or query execution fails
pub async fn get_sales_report<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx,
        Permissions::ACCESS_REPORTS,
    ) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
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
        "SELECT (subtotal_minor + tax_minor + charges_minor - discount_minor) as grand_total_minor, tax_minor, payment_method, created_at FROM orders WHERE tenant_id = ? AND location_id = ? AND status = 'Settled'"
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
