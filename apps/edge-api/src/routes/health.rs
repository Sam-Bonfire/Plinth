use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};
use std::sync::atomic::{AtomicU64, Ordering};

static START_TIME: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct HealthResponseDto {
    pub status: String,
    pub version: String,
    pub uptime_secs: u64,
    pub d1_reachable: bool,
}

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/health", health_check)
}

/// Health check endpoint that returns uptime, version and database reachability status.
///
/// # Errors
/// Returns an error if JSON serialization or request ID fetching fails.
pub async fn health_check<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let now = worker::Date::now().as_millis();
    let mut start = START_TIME.load(Ordering::Relaxed);
    if start == 0 {
        START_TIME.store(now, Ordering::Relaxed);
        start = now;
    }
    let uptime_secs = (now - start) / 1000;

    let d1_reachable = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => {
            let stmt = db.prepare("SELECT 1");
            stmt.run().await.is_ok()
        },
        Err(_) => false,
    };

    let res_dto = HealthResponseDto {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs,
        d1_reachable,
    };

    let request_id = crate::router::get_request_id(&req);
    match Response::from_json(&res_dto) {
        Ok(mut resp) => {
            if let Err(e) = resp.headers_mut().set("x-request-id", &request_id) {
                return crate::router::json_error(format!("Failed to set header: {e}"), "INTERNAL_ERROR", &request_id, 500);
            }
            Ok(resp)
        },
        Err(e) => crate::router::json_error(format!("JSON error: {e}"), "INTERNAL_ERROR", &request_id, 500),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_response_dto_serde() {
        let dto = HealthResponseDto {
            status: "ok".to_string(),
            version: "1.0.0".to_string(),
            uptime_secs: 42,
            d1_reachable: true,
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"version\":\"1.0.0\""));
        assert!(json.contains("\"uptime_secs\":42"));
        assert!(json.contains("\"d1_reachable\":true"));
    }
}
