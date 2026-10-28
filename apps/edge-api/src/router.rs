use worker::{Request, Result, Response, Router, Cors, Method};
use serde::Serialize;
use uuid::Uuid;
use crate::context::TenantContext;


#[derive(Serialize, specta::Type)]
pub struct ApiErrorResponse {
    pub error: String,
    pub code: String,
    pub request_id: String,
}

#[must_use]
pub fn get_request_id(req: &Request) -> String {
    req.headers()
        .get("x-request-id")
        .unwrap_or_default()
        .unwrap_or_else(|| Uuid::now_v7().to_string())
}

/// Helper function to create JSON error responses
///
/// # Errors
/// Returns an error if JSON serialization fails
pub fn json_error(error: impl Into<String>, code: impl Into<String>, request_id: &str, status: u16) -> Result<Response> {
    let body = ApiErrorResponse {
        error: error.into(),
        code: code.into(),
        request_id: request_id.to_string(),
    };
    let mut resp = Response::from_json(&body)?;
    resp = resp.with_status(status);
    resp.headers_mut().set("x-request-id", request_id)?;
    Ok(resp)
}

#[allow(clippy::cast_possible_wrap)]
#[must_use]
pub fn build_router(auth_context: Option<TenantContext>) -> Router<'static, Option<TenantContext>> {
    let router = Router::with_data(auth_context);
    let router = crate::routes::auth::register(router);
    let router = crate::routes::customer_auth::register(router);
    let router = crate::routes::crm::register(router);
    let router = crate::routes::staff::register(router);
    let router = crate::routes::webhooks::register(router);
    let router = crate::routes::inventory::register(router);
    let router = crate::routes::orders::register(router);
    let router = crate::routes::kds::register(router);
    let router = crate::routes::menu::register(router);
    let router = crate::routes::menu_sync::register(router);
    let router = crate::routes::public_menu::register(router);
    let router = crate::routes::public_orders::register(router);
    let router = crate::routes::audit::register(router);
    let router = crate::routes::mess::register(router);
    let router = crate::routes::eod::register(router);
    let router = crate::routes::reports::register(router);
    let router = crate::routes::ws::register(router);
    let router = crate::routes::health::register(router);
    let router = crate::routes::leads::register(router);
    let router = crate::routes::refunds::register(router);
    router
}

/// Origin list shared by CORS and the cookie CSRF check.
#[must_use]
pub fn allowed_origins(allowed_origins: Option<&str>) -> Vec<&str> {
    let origins_str = allowed_origins.unwrap_or("http://127.0.0.1:8787,http://localhost:5173,http://localhost:5174");
    origins_str.split(',').map(str::trim).filter(|s| !s.is_empty()).collect()
}

/// A cookie-authenticated mutation must come from an allowlisted origin.
/// Requests without an `Origin` header (native clients, curl) are not driven
/// by a browser cookie jar and stay unaffected.
#[must_use]
pub fn origin_allowed(origin: Option<&str>, allowed_origins_env: Option<&str>) -> bool {
    let Some(origin) = origin else {
        return true;
    };
    let origins = allowed_origins(allowed_origins_env);
    !origins.is_empty() && origins.contains(&origin)
}

/// Apply CORS configuration to a response
///
/// # Errors
/// Returns an error if applying CORS fails
pub fn apply_cors(resp: Response, allowed_origins: Option<&str>) -> Result<Response> {
    let mut cors = Cors::new()
        .with_methods(vec![Method::Get, Method::Post, Method::Put, Method::Delete, Method::Options])
        .with_allowed_headers(vec!["Authorization", "Content-Type", "x-tenant-id", "x-location-id", "x-request-id"]);

    let origins = self::allowed_origins(allowed_origins);

    if origins.is_empty() {
        // Strict fallback block if empty string passed in env var
        cors = cors.with_origins(vec!["https://no-origins-configured.invalid"]);
    } else {
        cors = cors.with_origins(origins).with_credentials(true);
    }

    resp.with_cors(&cors)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_allowlisted_and_native_origins() {
        assert!(origin_allowed(Some("http://localhost:5173"), Some("http://localhost:5173")));
        assert!(origin_allowed(None, Some("http://localhost:5173")));
    }

    #[test]
    fn rejects_unknown_and_empty_allowlists() {
        assert!(!origin_allowed(Some("https://evil.example"), Some("http://localhost:5173")));
        assert!(!origin_allowed(Some("http://localhost:5173"), Some("")));
    }
}
