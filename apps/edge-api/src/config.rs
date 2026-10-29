use serde::{Deserialize, Serialize};
use specta::Type;
use worker::Env;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct BusinessConfig {
    pub currency_code: String,
    pub default_gst_rate_percent: u8,
    pub tender_methods: Vec<String>,
    pub variance_anomaly_threshold_minor: i64,
    pub kitchen_sla_warning_minutes: u32,
    pub kitchen_sla_late_minutes: u32,
    pub aggregator_allowlist: Vec<String>,
    pub list_page_limit_small: u32,
    pub list_page_limit_large: u32,
}

impl BusinessConfig {
    #[must_use]
    pub fn from_env(env: &Env) -> Self {
        let currency_code = env.var("CURRENCY_CODE")
            .map(|v| v.to_string())
            .unwrap_or_else(|_| "INR".to_string());

        let default_gst_rate_percent = env.var("DEFAULT_GST_RATE_PERCENT")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(5);

        let tender_methods = env.var("TENDER_METHODS")
            .ok()
            .map(|v| v.to_string().split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| vec!["Cash".to_string(), "Card".to_string(), "UPI".to_string(), "Wallet".to_string()]);

        let variance_anomaly_threshold_minor = env.var("VARIANCE_ANOMALY_THRESHOLD_MINOR")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(50_000);

        let kitchen_sla_warning_minutes = env.var("KITCHEN_SLA_WARNING_MINUTES")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(240);

        let kitchen_sla_late_minutes = env.var("KITCHEN_SLA_LATE_MINUTES")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(480);

        let aggregator_allowlist = env.var("AGGREGATOR_ALLOWLIST")
            .ok()
            .map(|v| v.to_string().split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| vec!["Swiggy".to_string(), "Zomato".to_string()]);

        let list_page_limit_small = env.var("LIST_PAGE_LIMIT_SMALL")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(50);

        let list_page_limit_large = env.var("LIST_PAGE_LIMIT_LARGE")
            .ok()
            .and_then(|v| v.to_string().parse().ok())
            .unwrap_or(100);

        Self {
            currency_code,
            default_gst_rate_percent,
            tender_methods,
            variance_anomaly_threshold_minor,
            kitchen_sla_warning_minutes,
            kitchen_sla_late_minutes,
            aggregator_allowlist,
            list_page_limit_small,
            list_page_limit_large,
        }
    }
}
