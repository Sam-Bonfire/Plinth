use crate::auth::JwtClaims;
use crate::db::refresh_tokens;
use crate::session::{self, RotationError, SessionPolicy};
use jsonwebtoken::{Algorithm, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{Request, Response, Result, RouteContext, Router};
use chrono::Utc;

/// Normalizes phone number, returning only digits if valid (7-15 length)
fn normalize_phone(raw: &str) -> Option<String> {
    let stripped: String = raw
        .chars()
        .filter(|c| *c != ' ' && *c != '-' && *c != '(' && *c != ')')
        .collect();
    let digits = stripped.strip_prefix('+').unwrap_or(&stripped);
    if !digits.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    if !(7..=15).contains(&digits.len()) {
        return None;
    }
    Some(stripped)
}

/// Request payload for customer registration
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RegisterRequest {
    pub tenant_id: String,
    pub location_id: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
}

/// Request payload for customer login
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginRequest {
    pub tenant_id: String,
    pub phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CustomerProfile {
    pub id: String,
    pub tenant_id: String,
    pub location_id: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub loyalty_points: i64,
}

/// Session state returned to portal clients. No credential is included:
/// tokens only ever travel in `HttpOnly` cookies.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginResponse {
    pub customer: CustomerProfile,
    pub expires_in: usize,
}

/// Current customer session without credential material.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SessionResponse {
    pub customer_id: String,
    pub tenant_id: String,
    pub location_id: String,
    pub expires_in: usize,
}

/// Registers auth routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/customer-auth/register", register_customer)
        .post_async("/api/v1/customer-auth/login", login)
        .get_async("/api/v1/customer-auth/session", current_session)
        .post_async("/api/v1/customer-auth/refresh", refresh)
        .post_async("/api/v1/customer-auth/logout", logout)
}

/// Registers a new customer
///
/// # Errors
/// Returns an error if payload is invalid, DB operations fail, or UUID parsing fails.
pub async fn register_customer<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let payload: RegisterRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &request_id, 400),
    };

    if Uuid::parse_str(&payload.tenant_id).is_err() || Uuid::parse_str(&payload.location_id).is_err() {
        return crate::router::json_error("Invalid tenant or location UUID format", "INVALID_PAYLOAD", &request_id, 400);
    }

    if payload.name.trim().is_empty() {
        return crate::router::json_error("Name cannot be empty", "INVALID_PAYLOAD", &request_id, 400);
    }

    let Some(phone) = normalize_phone(&payload.phone) else {
        return crate::router::json_error("Invalid phone number format", "INVALID_PAYLOAD", &request_id, 400);
    };

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    let customer_id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();

    let Ok(stmt) = db.prepare(
        "INSERT INTO customers (id, tenant_id, location_id, name, phone, email, loyalty_points, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    ).bind(&[
        customer_id.clone().into(),
        payload.tenant_id.clone().into(),
        payload.location_id.clone().into(),
        payload.name.trim().to_string().into(),
        phone.clone().into(),
        payload.email.clone().into(),
        0.into(),
        now.into(),
    ]) else {
        return crate::router::json_error("Database binding error", "INTERNAL_ERROR", &request_id, 500);
    };

    if let Err(e) = stmt.run().await {
        return crate::router::internal_error(&req, format!("Failed to insert customer: {e}"));
    }

    let profile = CustomerProfile {
        id: customer_id,
        tenant_id: payload.tenant_id,
        location_id: payload.location_id,
        name: payload.name.trim().to_string(),
        phone,
        email: payload.email,
        loyalty_points: 0,
    };

    Response::from_json(&profile)
}

/// Authenticates a customer using phone number and issues a signed JWT
///
/// # Errors
/// Returns an error if payload is invalid, customer not found, or database/signing fails.
#[allow(clippy::too_many_lines)]
pub async fn login<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let payload: LoginRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &request_id, 400),
    };

    if Uuid::parse_str(&payload.tenant_id).is_err() {
        return crate::router::json_error("Invalid tenant UUID format", "INVALID_PAYLOAD", &request_id, 400);
    }

    let Some(phone) = normalize_phone(&payload.phone) else {
        return crate::router::json_error("Invalid phone number format", "INVALID_PAYLOAD", &request_id, 400);
    };

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    if let Ok(true) = crate::lockout::is_locked_out(&db, &payload.tenant_id, &phone).await {
        worker::console_error!("Lockout enforced for customer phone: {}", phone);
        let _ = crate::lockout::record_attempt(&db, &payload.tenant_id, &phone, false).await;
        return crate::router::json_error("Customer not found", "NOT_FOUND", &request_id, 404);
    }

    let Ok(stmt) = db.prepare(
        "SELECT id, location_id, name, phone, email, loyalty_points FROM customers WHERE tenant_id = ?1 AND phone = ?2 AND deleted_at IS NULL"
    ).bind(&[
        payload.tenant_id.clone().into(),
        phone.clone().into(),
    ]) else {
        return crate::router::json_error("Database binding error", "INTERNAL_ERROR", &request_id, 500);
    };

    let row_opt = match stmt.first::<serde_json::Value>(None).await {
        Ok(r) => r,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let Some(row) = row_opt else {
        let event_id = Uuid::now_v7().to_string();
        let now = Utc::now().to_rfc3339();
        if let Ok(stmt) = db.prepare(
            "INSERT INTO login_events (id, tenant_id, customer_id, channel, success, occurred_at) VALUES (?1, ?2, NULL, ?3, ?4, ?5)"
        ).bind(&[
            event_id.into(),
            payload.tenant_id.clone().into(),
            "Web".into(),
            0.into(),
            now.into(),
        ]) {
            let _ = stmt.run().await;
        }

        let _ = crate::lockout::record_attempt(&db, &payload.tenant_id, &phone, false).await;

        return crate::router::json_error("Customer not found", "NOT_FOUND", &request_id, 404);
    };

    let customer_id = row.get("id").and_then(serde_json::Value::as_str).unwrap_or_default().to_string();
    let location_id = row.get("location_id").and_then(serde_json::Value::as_str).unwrap_or_default().to_string();
    let name = row.get("name").and_then(serde_json::Value::as_str).unwrap_or_default().to_string();
    let email = row.get("email").and_then(serde_json::Value::as_str).map(ToString::to_string);
    let loyalty_points = row.get("loyalty_points").and_then(serde_json::Value::as_i64).unwrap_or(0);

    let event_id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    if let Ok(stmt) = db.prepare(
        "INSERT INTO login_events (id, tenant_id, customer_id, channel, success, occurred_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    ).bind(&[
        event_id.into(),
        payload.tenant_id.clone().into(),
        customer_id.clone().into(),
        "Web".into(),
        1.into(),
        now.into(),
    ]) {
        let _ = stmt.run().await;
    }

    let _ = crate::lockout::record_attempt(&db, &payload.tenant_id, &phone, true).await;

    let policy = SessionPolicy::customer(&ctx);
    let expires_in = usize::try_from(policy.access_ttl_secs).unwrap_or(0);
    let claims = customer_claims(&customer_id, &payload.tenant_id, &location_id, policy.access_ttl_secs);

    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &request_id, 500);
    };
    let access_token = match sign_claims(&claims, &secret) {
        Ok(t) => t,
        Err(e) => return crate::router::internal_error(&req, format!("Failed to sign token: {e}")),
    };

    let refresh_token = session::new_refresh_token();
    if let Err(e) = refresh_tokens::insert(
        &db,
        &claims.tenant_id,
        &claims.location_id,
        "customer",
        &claims.sub,
        &session::hash_token(&refresh_token),
        &policy.refresh_expiry().to_rfc3339(),
        &Utc::now().to_rfc3339(),
    )
    .await
    {
        return crate::router::json_error(format!("Failed to start session: {e}"), "INTERNAL_ERROR", &request_id, 500);
    }

    let profile = CustomerProfile {
        id: customer_id,
        tenant_id: payload.tenant_id,
        location_id,
        name,
        phone,
        email,
        loyalty_points,
    };

    let resp = Response::from_json(&LoginResponse {
        customer: profile,
        expires_in,
    })?;
    let resp = session::set_cookie(
        resp,
        &session::session_cookie(session::ACCESS_COOKIE, &access_token, policy.access_ttl_secs),
    )?;
    session::set_cookie(
        resp,
        &session::session_cookie(session::REFRESH_COOKIE, &refresh_token, policy.refresh_ttl_secs),
    )
}

/// Reads the current customer session from the access cookie.
///
/// # Errors
/// Returns `UNAUTHORIZED` when the cookie is missing, invalid or not a
/// customer token.
pub async fn current_session<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &request_id, 500);
    };
    let Some(token) = session::read_cookie(&req, session::ACCESS_COOKIE) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    };
    let Ok(claims) = crate::auth::verify_token(&token, &secret) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    };
    if claims.token_type != "customer" {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    }

    Response::from_json(&SessionResponse {
        customer_id: claims.sub,
        tenant_id: claims.tenant_id,
        location_id: claims.location_id,
        expires_in: usize::try_from(SessionPolicy::customer(&ctx).access_ttl_secs).unwrap_or(0),
    })
}

/// Rotates the customer refresh cookie and re-issues the profile.
///
/// # Errors
/// Returns `SESSION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` or
/// `SESSION_REVOKED` distinctly.
pub async fn refresh<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Some(presented) = session::read_cookie(&req, session::REFRESH_COOKIE) else {
        return crate::router::json_error("No refresh token", "SESSION_REQUIRED", &request_id, 401);
    };
    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &request_id, 500);
    };
    let stored = match refresh_tokens::find_by_hash(&db, &session::hash_token(&presented)).await {
        Ok(row) => row,
        Err(e) => return crate::router::json_error(format!("Session lookup failed: {e}"), "INTERNAL_ERROR", &request_id, 500),
    };
    let now = Utc::now();
    if let Err(err) = session::check_rotation(stored.as_ref(), now) {
        if err == RotationError::Revoked {
            if let Some(row) = &stored {
                let _ = refresh_tokens::revoke_all_for_subject(&db, &row.tenant_id, &row.subject_type, &row.subject_id, &now.to_rfc3339()).await;
            }
        }
        return reject_rotation(err, &request_id);
    }
    let Some(stored) = stored else {
        return reject_rotation(RotationError::Invalid, &request_id);
    };
    if stored.subject_type != "customer" {
        return reject_rotation(RotationError::Invalid, &request_id);
    }

    let Ok(Some(profile)) = load_customer(&db, &stored.tenant_id, &stored.subject_id).await else {
        let _ = refresh_tokens::revoke_all_for_subject(&db, &stored.tenant_id, "customer", &stored.subject_id, &now.to_rfc3339()).await;
        return reject_rotation(RotationError::Invalid, &request_id);
    };

    let policy = SessionPolicy::customer(&ctx);
    let expires_in = usize::try_from(policy.access_ttl_secs).unwrap_or(0);
    let claims = customer_claims(&stored.subject_id, &stored.tenant_id, &stored.location_id, policy.access_ttl_secs);
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &request_id, 500);
    };
    let Ok(access_token) = sign_claims(&claims, &secret) else {
        return crate::router::json_error("Failed to sign token", "INTERNAL_ERROR", &request_id, 500);
    };
    let refresh_token = session::new_refresh_token();
    if let Err(e) = refresh_tokens::insert(
        &db,
        &stored.tenant_id,
        &stored.location_id,
        "customer",
        &stored.subject_id,
        &session::hash_token(&refresh_token),
        &policy.refresh_expiry().to_rfc3339(),
        &now.to_rfc3339(),
    )
    .await
    {
        return crate::router::json_error(format!("Failed to rotate session: {e}"), "INTERNAL_ERROR", &request_id, 500);
    }
    let _ = refresh_tokens::revoke(&db, &session::hash_token(&presented), &now.to_rfc3339()).await;

    let resp = Response::from_json(&LoginResponse { customer: profile, expires_in })?;
    let resp = session::set_cookie(
        resp,
        &session::session_cookie(session::ACCESS_COOKIE, &access_token, policy.access_ttl_secs),
    )?;
    session::set_cookie(
        resp,
        &session::session_cookie(session::REFRESH_COOKIE, &refresh_token, policy.refresh_ttl_secs),
    )
}

/// Revokes the presented customer refresh session and clears both cookies.
///
/// # Errors
/// Returns an error only if the response envelope cannot be built.
pub async fn logout<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    if let Some(presented) = session::read_cookie(&req, session::REFRESH_COOKIE) {
        if let Ok(db) = ctx.env.d1("CELLAR_DB") {
            let _ = refresh_tokens::revoke(&db, &session::hash_token(&presented), &Utc::now().to_rfc3339()).await;
        }
    }
    let resp = session::set_cookie(
        Response::from_json(&serde_json::json!({ "success": true }))?,
        &session::cleared_cookie(session::ACCESS_COOKIE),
    )?;
    session::set_cookie(resp, &session::cleared_cookie(session::REFRESH_COOKIE))
}

fn customer_claims(sub: &str, tenant_id: &str, location_id: &str, access_ttl_secs: i64) -> JwtClaims {
    let now_ts = usize::try_from(Utc::now().timestamp()).unwrap_or(0);
    let ttl = usize::try_from(access_ttl_secs).unwrap_or(0);
    JwtClaims {
        sub: sub.to_string(),
        iss: "plinth-auth".to_string(),
        exp: now_ts + ttl,
        tenant_id: tenant_id.to_string(),
        location_id: location_id.to_string(),
        roles: vec!["Customer".to_string()],
        permissions: 0,
        token_type: "customer".to_string(),
    }
}

fn sign_claims(claims: &JwtClaims, secret: &str) -> std::result::Result<String, jsonwebtoken::errors::Error> {
    jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
}

async fn load_customer(
    db: &worker::d1::D1Database,
    tenant_id: &str,
    customer_id: &str,
) -> worker::Result<Option<CustomerProfile>> {
    let row = db
        .prepare(
            "SELECT id, location_id, name, phone, email, loyalty_points FROM customers WHERE id = ?1 AND tenant_id = ?2 AND deleted_at IS NULL",
        )
        .bind(&[customer_id.into(), tenant_id.into()])?
        .first::<serde_json::Value>(None)
        .await?;
    Ok(row.as_ref().map(|row| CustomerProfile {
        id: row.get("id").and_then(serde_json::Value::as_str).unwrap_or_default().to_string(),
        tenant_id: tenant_id.to_string(),
        location_id: row.get("location_id").and_then(serde_json::Value::as_str).unwrap_or_default().to_string(),
        name: row.get("name").and_then(serde_json::Value::as_str).unwrap_or_default().to_string(),
        phone: row.get("phone").and_then(serde_json::Value::as_str).unwrap_or_default().to_string(),
        email: row.get("email").and_then(serde_json::Value::as_str).map(ToString::to_string),
        loyalty_points: row.get("loyalty_points").and_then(serde_json::Value::as_i64).unwrap_or(0),
    }))
}

fn reject_rotation(err: RotationError, request_id: &str) -> Result<Response> {
    let resp = crate::router::json_error(err.to_string(), err.code(), request_id, 401)?;
    let resp = session::set_cookie(resp, &session::cleared_cookie(session::ACCESS_COOKIE))?;
    session::set_cookie(resp, &session::cleared_cookie(session::REFRESH_COOKIE))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_phone() {
        assert_eq!(normalize_phone("+91 98200 12345"), Some("+919820012345".to_string()));
        assert_eq!(normalize_phone("9820012345"), Some("9820012345".to_string()));
        assert_eq!(normalize_phone("123"), None);
        assert_eq!(normalize_phone("abcdefghij"), None);
        assert_eq!(normalize_phone("+91-98A001234"), None);
        assert_eq!(normalize_phone(""), None);
    }

    #[test]
    fn test_register_request_serde() {
        let req = RegisterRequest {
            tenant_id: Uuid::now_v7().to_string(),
            location_id: Uuid::now_v7().to_string(),
            name: "John Doe".to_string(),
            phone: "+1234567890".to_string(),
            email: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("John Doe"));
        assert!(json.contains("+1234567890"));
    }

    #[test]
    fn test_login_request_serde() {
        let req = LoginRequest {
            tenant_id: Uuid::now_v7().to_string(),
            phone: "+1234567890".to_string(),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("+1234567890"));
    }
}
