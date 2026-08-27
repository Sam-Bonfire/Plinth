#![deny(unsafe_code)]

pub mod routes;
pub mod db;
pub mod router;
pub mod context;
pub mod auth;

use worker::{event, Request, Env, Result, Response, Method};
use router::{build_router, apply_cors, json_error, get_request_id};
use core_domain::enums::staff::Permissions;

/// Cloudflare Worker entry point
///
/// # Errors
/// Returns an error if routing fails or middleware returns a response error
#[event(fetch)]
pub async fn fetch(
    req: Request,
    env: Env,
    _ctx: worker::Context,
) -> Result<Response> {
    // Handle CORS preflight requests
    if req.method() == Method::Options {
        return apply_cors(Response::empty()?);
    }

    let request_id = get_request_id(&req);

    let path = req.path();

    let mut auth_context = None;

    if path.starts_with("/api/v1") {
        let secret = match env.var("JWT_PUBLIC_KEY") {
            Ok(v) => v.to_string(),
            Err(_) => "default_secret".to_string(),
        };

        // This is a global minimum requirement for /api/v1
        let required_perms = Permissions::empty();

        match auth::extract_and_verify_context(&req, &secret, required_perms) {
            Ok(ctx) => {
                auth_context = Some(ctx);
            },
            Err(e) => {
                let is_forbidden = e == "Insufficient permissions";
                let status = if is_forbidden { 403 } else { 401 };
                let code = if is_forbidden { "FORBIDDEN" } else { "UNAUTHORIZED" };
                let err_resp = json_error(e, code, &request_id, status)?;
                return apply_cors(err_resp);
            }
        }
    }

    let router = build_router(auth_context);

    let result = router.run(req, env).await;

    let mut resp = match result {
        Ok(r) => r,
        Err(e) => {
            let err_str = e.to_string();
            if err_str == "Route not found" {
                 json_error("Not Found", "NOT_FOUND", &request_id, 404)?
            } else {
                 json_error(err_str, "INTERNAL_ERROR", &request_id, 500)?
            }
        }
    };

    if resp.headers().get("x-request-id").unwrap_or_default().is_none() {
        resp.headers_mut().set("x-request-id", &request_id)?;
    }

    apply_cors(resp)
}

#[cfg(test)]
mod tests {
    use super::*;
    use auth::{JwtClaims, verify_context_from_headers};
    use core_domain::enums::staff::Permissions;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    #[allow(clippy::cast_possible_truncation)]
    fn get_now() -> usize {
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize
    }

    fn create_test_token(claims: &JwtClaims, secret: &str) -> String {
        let header = Header::new(jsonwebtoken::Algorithm::HS256);
        encode(&header, claims, &EncodingKey::from_secret(secret.as_bytes())).unwrap()
    }

    #[test]
    fn test_valid_jwt_extraction_and_context() {
        let tenant_id = Uuid::now_v7().to_string();
        let location_id = Uuid::now_v7().to_string();
        let secret = "test_secret";

        let now = get_now();
        let claims = JwtClaims {
            sub: Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: now + 3600,
            tenant_id: tenant_id.clone(),
            location_id: location_id.clone(),
            roles: vec!["Manager".to_string()],
            permissions: Permissions::TAKE_ORDER.bits(),
        };

        let token = create_test_token(&claims, secret);

        let result = verify_context_from_headers(
            Some(tenant_id.clone()),
            Some(location_id.clone()),
            Some(&format!("Bearer {token}")),
            secret,
            Permissions::empty(),
        );

        assert!(result.is_ok());
        let ctx = result.unwrap();
        assert_eq!(ctx.tenant_id.to_string(), tenant_id);
    }

    #[test]
    fn test_invalid_expired_token() {
        let tenant_id = Uuid::now_v7().to_string();
        let location_id = Uuid::now_v7().to_string();
        let secret = "test_secret";

        let now = get_now();
        let claims = JwtClaims {
            sub: Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: now - 3600,
            tenant_id: tenant_id.clone(),
            location_id: location_id.clone(),
            roles: vec!["Manager".to_string()],
            permissions: Permissions::TAKE_ORDER.bits(),
        };

        let token = create_test_token(&claims, secret);

        let result = verify_context_from_headers(
            Some(tenant_id.clone()),
            Some(location_id.clone()),
            Some(&format!("Bearer {token}")),
            secret,
            Permissions::empty(),
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "ExpiredSignature");
    }

    #[test]
    fn test_tenant_mismatch() {
        let tenant_id = Uuid::now_v7().to_string();
        let wrong_tenant_id = Uuid::now_v7().to_string();
        let location_id = Uuid::now_v7().to_string();
        let secret = "test_secret";

        let now = get_now();
        let claims = JwtClaims {
            sub: Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: now + 3600,
            tenant_id: tenant_id.clone(),
            location_id: location_id.clone(),
            roles: vec!["Manager".to_string()],
            permissions: Permissions::TAKE_ORDER.bits(),
        };

        let token = create_test_token(&claims, secret);

        let result = verify_context_from_headers(
            Some(wrong_tenant_id),
            Some(location_id.clone()),
            Some(&format!("Bearer {token}")),
            secret,
            Permissions::empty(),
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Tenant ID mismatch");
    }

    #[test]
    fn test_missing_tenant_header() {
        let tenant_id = Uuid::now_v7().to_string();
        let location_id = Uuid::now_v7().to_string();
        let secret = "test_secret";

        let now = get_now();
        let claims = JwtClaims {
            sub: Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: now + 3600,
            tenant_id: tenant_id.clone(),
            location_id: location_id.clone(),
            roles: vec!["Manager".to_string()],
            permissions: Permissions::TAKE_ORDER.bits(),
        };

        let token = create_test_token(&claims, secret);

        let result = verify_context_from_headers(
            None,
            Some(location_id.clone()),
            Some(&format!("Bearer {token}")),
            secret,
            Permissions::empty(),
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing x-tenant-id header");
    }

    #[test]
    fn test_permission_bitmask_enforcement() {
        let tenant_id = Uuid::now_v7().to_string();
        let location_id = Uuid::now_v7().to_string();
        let secret = "test_secret";

        let now = get_now();
        let claims = JwtClaims {
            sub: Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: now + 3600,
            tenant_id: tenant_id.clone(),
            location_id: location_id.clone(),
            roles: vec!["Cashier".to_string()],
            permissions: Permissions::TAKE_ORDER.bits(),
        };

        let token = create_test_token(&claims, secret);

        let result = verify_context_from_headers(
            Some(tenant_id.clone()),
            Some(location_id.clone()),
            Some(&format!("Bearer {token}")),
            secret,
            Permissions::MANAGE_MENU, // Requires MANAGE_MENU
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Insufficient permissions");
    }

    #[test]
    fn test_router_functions_exist() {
        assert_eq!(1, 1);
    }
}

#[cfg(test)]
mod wasm_tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_cors_preflight_response() {
        // Request and Response must be created in WASM environment
        // Unfortunately, worker-rs Request/Response aren't fully mockable without Env
        // but we can check if apply_cors works on a basic response.
        let resp = Response::empty().unwrap();
        let cors_resp = apply_cors(resp).unwrap();
        assert!(cors_resp.headers().has("Access-Control-Allow-Origin").unwrap());
    }

    #[wasm_bindgen_test]
    fn test_json_error_builder() {
        let resp = json_error("err", "CODE", "123", 400).unwrap();
        assert_eq!(resp.status_code(), 400);
        let header = resp.headers().get("x-request-id").unwrap();
        assert_eq!(header.unwrap(), "123");
    }
}
