use worker::{Request, Result, Response, Router, Cors, Method};
use serde::Serialize;
use uuid::Uuid;
use crate::context::TenantContext;


#[derive(Serialize)]
pub struct ApiErrorResponse {
    pub error: String,
    pub code: String,
    pub request_id: String,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: i64,
    pub version: String,
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
    let router = crate::routes::inventory::register(router);
    let router = crate::routes::orders::register(router);
    let router = crate::routes::kds::register(router);
    let router = crate::routes::menu::register(router);
    router.get_async("/health", |req, _ctx| async move {
            let request_id = get_request_id(&req);
            let health = HealthResponse {
                status: "ok".to_string(),
                timestamp: worker::Date::now().as_millis() as i64,
                version: env!("CARGO_PKG_VERSION").to_string(),
            };
            let mut resp = Response::from_json(&health)?;
            resp.headers_mut().set("x-request-id", &request_id)?;
            Ok(resp)
        })
}

/// Apply CORS configuration to a response
///
/// # Errors
/// Returns an error if applying CORS fails
pub fn apply_cors(resp: Response) -> Result<Response> {
    let cors = Cors::new()
        .with_origins(vec!["*"])
        .with_methods(vec![Method::Get, Method::Post, Method::Put, Method::Delete, Method::Options])
        .with_allowed_headers(vec!["Authorization", "Content-Type", "x-tenant-id", "x-location-id", "x-request-id"]);

    resp.with_cors(&cors)
}
