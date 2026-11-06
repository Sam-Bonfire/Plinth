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

fn var(env: &Env, key: &str) -> Option<String> {
    env.var(key).ok().map(|v| v.to_string())
}

fn list(env: &Env, key: &str, default: &[&str]) -> Vec<String> {
    var(env, key).map_or_else(
        || default.iter().map(|s| (*s).to_string()).collect(),
        |v| v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
    )
}

fn number<T: std::str::FromStr>(env: &Env, key: &str, default: T) -> T {
    var(env, key).and_then(|v| v.parse().ok()).unwrap_or(default)
}

impl BusinessConfig {
    #[must_use]
    pub fn from_env(env: &Env) -> Self {
        Self {
            currency_code: var(env, "CURRENCY_CODE").unwrap_or_else(|| "INR".to_string()),
            default_gst_rate_percent: number(env, "DEFAULT_GST_RATE_PERCENT", 5),
            tender_methods: list(env, "TENDER_METHODS", &["Cash", "Card", "UPI", "Wallet"]),
            variance_anomaly_threshold_minor: number(env, "VARIANCE_ANOMALY_THRESHOLD_MINOR", 50_000),
            kitchen_sla_warning_minutes: number(env, "KITCHEN_SLA_WARNING_MINUTES", 240),
            kitchen_sla_late_minutes: number(env, "KITCHEN_SLA_LATE_MINUTES", 480),
            aggregator_allowlist: list(env, "AGGREGATOR_ALLOWLIST", &["Swiggy", "Zomato"]),
            list_page_limit_small: number(env, "LIST_PAGE_LIMIT_SMALL", 50),
            list_page_limit_large: number(env, "LIST_PAGE_LIMIT_LARGE", 100),
        }
    }
}
