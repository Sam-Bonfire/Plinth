use crate::auth::JwtClaims;
use crate::db::refresh_tokens;
use crate::session::{self, RotationError, SessionPolicy};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use core_domain::{
    enums::staff::{Permissions, StaffRole},
    ids::StaffMemberId,
};
use jsonwebtoken::{Algorithm, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{Request, Response, Result, RouteContext, Router};

fn verify_pin_hash(hash: &str, pin: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok()
}

/// Request payload for staff login / PIN authentication.
/// The role is always read from the stored staff row: callers cannot
/// grant themselves a role.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginRequest {
    pub staff_id: StaffMemberId,
    pub pin: String,
}

/// Session state returned to browser clients. It deliberately carries no
/// credential: tokens only ever travel in `HttpOnly` cookies.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginResponse {
    pub staff_id: StaffMemberId,
    pub role: StaffRole,
    pub permissions: u32,
    pub expires_in: usize,
}

/// Current staff session, read back without exposing tokens.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SessionResponse {
    pub staff_id: String,
    pub tenant_id: String,
    pub location_id: String,
    pub role: String,
    pub permissions: u32,
    pub expires_in: usize,
}


/// Stored staff identity fields needed to decide a login.
pub struct StoredStaffIdentity {
    pub role: Option<String>,
    pub permissions: Option<u64>,
    pub pin_hash: Option<String>,
}

/// Why a login was refused. Unknown staff and bad PIN map to the same
/// caller-facing error so usernames cannot be enumerated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoginRefusal {
    UnknownStaff,
    InvalidPin,
}

/// Maps a stored role name to the domain role. Unknown names fall back to the
/// least-privileged role instead of granting anything extra.
#[must_use]
pub fn role_from_str(raw: Option<&str>) -> StaffRole {
    match raw {
        Some("Owner") => StaffRole::Owner,
        Some("Manager") => StaffRole::Manager,
        Some("Cashier") => StaffRole::Cashier,
        Some("Kitchen") => StaffRole::Kitchen,
        _ => StaffRole::Waiter,
    }
}

/// Pure login decision: fail closed when the row is absent, the hash is
/// missing, or the `PIN` does not verify. The role always comes from the
/// stored row, never from the request.
///
/// # Errors
/// Returns `LoginRefusal::UnknownStaff` when no staff row matches, and
/// `LoginRefusal::InvalidPin` when the hash is missing or does not verify.
pub fn resolve_login_identity(
    row: Option<StoredStaffIdentity>,
    pin: &str,
) -> std::result::Result<(StaffRole, u32), LoginRefusal> {
    let Some(stored) = row else {
        return Err(LoginRefusal::UnknownStaff);
    };
    let Some(hash) = stored.pin_hash.as_deref().filter(|h| !h.is_empty()) else {
        return Err(LoginRefusal::InvalidPin);
    };
    if !verify_pin_hash(hash, pin) {
        return Err(LoginRefusal::InvalidPin);
    }
    let role = role_from_str(stored.role.as_deref());
    let permissions = stored.permissions.and_then(|v| u32::try_from(v).ok()).unwrap_or_else(|| role.default_permissions().bits());
    Ok((role, permissions))
}

/// Registers auth routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/auth/login", login)
        .get_async("/api/v1/auth/session", current_session)
        .post_async("/api/v1/auth/refresh", refresh)
        .post_async("/api/v1/auth/logout", logout)
        .post_async("/api/v1/auth/revoke", revoke_sessions)
}

/// Authenticates a staff member using PIN / credentials and issues a signed JWT
///
/// # Errors
/// Returns an error if headers are missing, payload is invalid, or signing fails
pub async fn login<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let header_tenant_id = req.headers().get("x-tenant-id").ok().flatten();
    let header_location_id = req.headers().get("x-location-id").ok().flatten();

    let Some(tenant_id_str) = header_tenant_id else {
        return crate::router::json_error("Missing x-tenant-id header", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };
    let Some(location_id_str) = header_location_id else {
        return crate::router::json_error("Missing x-location-id header", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    if Uuid::parse_str(&tenant_id_str).is_err() || Uuid::parse_str(&location_id_str).is_err() {
        return crate::router::json_error("Invalid tenant or location UUID format", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }

    let payload: LoginRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    if payload.pin.trim().is_empty() {
        return crate::router::json_error("PIN cannot be empty", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }

    // Fail closed: no database means no authentication, never a token.
    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };

    if let Ok(true) = crate::lockout::is_locked_out(&db, &tenant_id_str, &payload.staff_id.to_string()).await {
        worker::console_error!("Lockout enforced for staff_id: {}", payload.staff_id);
        return crate::router::json_error("Invalid staff ID or PIN", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    }

    let Ok(stmt) = db
        .prepare(
            "SELECT role, permissions, pin_hash FROM staff_members WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3 AND deleted_at IS NULL AND is_active = 1",
        )
        .bind(&[
            payload.staff_id.to_string().into(),
            tenant_id_str.clone().into(),
            location_id_str.clone().into(),
        ])
    else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };
    let stored = match stmt.first::<serde_json::Value>(None).await {
        Ok(Some(row)) => Some(StoredStaffIdentity {
            role: row.get("role").and_then(serde_json::Value::as_str).map(ToString::to_string),
            permissions: row.get("permissions").and_then(serde_json::Value::as_u64),
            pin_hash: row.get("pin_hash").and_then(serde_json::Value::as_str).map(ToString::to_string),
        }),
        Ok(None) => None,
        Err(_) => {
            return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
        }
    };
    // Unknown staff and bad PIN share one response so staff IDs cannot be enumerated.
    let Ok((role, permissions)) = resolve_login_identity(stored, &payload.pin) else {
        let _ = crate::lockout::record_attempt(&db, &tenant_id_str, &payload.staff_id.to_string(), false).await;
        return crate::router::json_error("Invalid staff ID or PIN", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let _ = crate::lockout::record_attempt(&db, &tenant_id_str, &payload.staff_id.to_string(), true).await;

    let policy = SessionPolicy::staff(&ctx);
    let expires_in = usize::try_from(policy.access_ttl_secs).unwrap_or(0);
    let claims = build_staff_claims(
        payload.staff_id.to_string(),
        tenant_id_str,
        location_id_str,
        format!("{role:?}"),
        permissions,
        policy.access_ttl_secs,
    );

    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };
    let access_token = match sign_claims(&claims, &secret) {
        Ok(t) => t,
        Err(e) => return crate::router::internal_error(&req, format!("Failed to sign token: {e}")),
    };

    let refresh_token = session::new_refresh_token();
    let refresh_expiry = policy.refresh_expiry().to_rfc3339();
    if let Err(e) = refresh_tokens::insert(
        &db,
        &claims.tenant_id,
        &claims.location_id,
        "staff",
        &claims.sub,
        &session::hash_token(&refresh_token),
        &refresh_expiry,
        &chrono::Utc::now().to_rfc3339(),
    )
    .await
    {
        return crate::router::json_error(format!("Failed to start session: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    }

    let body = LoginResponse {
        staff_id: payload.staff_id,
        role,
        permissions,
        expires_in,
    };

    session_cookies_response(&body, &access_token, &refresh_token, policy)
}

/// Reads the current staff session from the access cookie (or bearer token).
///
/// # Errors
/// Returns the uniform rejection envelope when the caller is not authenticated.
pub async fn current_session<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Ok(auth_context) = crate::auth::authorize(&req, &ctx, Permissions::empty()) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    };
    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &request_id, 500);
    };
    let identity = match staff_identity_by_id(
        &db,
        &auth_context.tenant_id.to_string(),
        &auth_context.location_id.to_string(),
        &auth_context.staff_id.to_string(),
    )
    .await
    {
        Ok(Some(identity)) => identity,
        Ok(None) => return crate::router::json_error("Staff member is not active", "UNAUTHORIZED", &request_id, 401),
        Err(_) => return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &request_id, 500),
    };

    Response::from_json(&SessionResponse {
        staff_id: auth_context.staff_id.to_string(),
        tenant_id: auth_context.tenant_id.to_string(),
        location_id: auth_context.location_id.to_string(),
        role: format!("{:?}", identity.0),
        permissions: identity.1,
        expires_in: usize::try_from(SessionPolicy::staff(&ctx).access_ttl_secs).unwrap_or(0),
    })
}

/// Rotates the refresh cookie, revoking the presented token. A replayed token
/// means theft, so it revokes every live session for that staff member.
///
/// # Errors
/// Returns `SESSION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED` or
/// `SESSION_REVOKED` distinctly so clients can prompt correctly.
pub async fn refresh<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Some(presented) = session::read_cookie(&req, session::REFRESH_COOKIE) else {
        return crate::router::json_error("No refresh token", "SESSION_REQUIRED", &request_id, 401);
    };
    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &request_id, 500);
    };
    let stored = match refresh_tokens::find_by_hash(&db, &session::hash_token(&presented)).await {
        Ok(session) => session,
        Err(e) => return crate::router::json_error(format!("Session lookup failed: {e}"), "INTERNAL_ERROR", &request_id, 500),
    };
    let now = chrono::Utc::now();

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
    if stored.subject_type != "staff" {
        return reject_rotation(RotationError::Invalid, &request_id);
    }

    let Ok(Some((role, permissions))) = staff_identity_by_id(&db, &stored.tenant_id, &stored.location_id, &stored.subject_id).await else {
        let _ = refresh_tokens::revoke_all_for_subject(&db, &stored.tenant_id, "staff", &stored.subject_id, &now.to_rfc3339()).await;
        return reject_rotation(RotationError::Invalid, &request_id);
    };

    let policy = SessionPolicy::staff(&ctx);
    let claims = build_staff_claims(
        stored.subject_id.clone(),
        stored.tenant_id.clone(),
        stored.location_id.clone(),
        format!("{role:?}"),
        permissions,
        policy.access_ttl_secs,
    );
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &request_id, 500);
    };
    let Ok(access_token) = sign_claims(&claims, &secret) else {
        return crate::router::json_error("Failed to sign token", "INTERNAL_ERROR", &request_id, 500);
    };

    let refresh_token = session::new_refresh_token();
    let refresh_expiry = policy.refresh_expiry().to_rfc3339();
    if let Err(e) = refresh_tokens::insert(
        &db,
        &stored.tenant_id,
        &stored.location_id,
        "staff",
        &stored.subject_id,
        &session::hash_token(&refresh_token),
        &refresh_expiry,
        &now.to_rfc3339(),
    )
    .await
    {
        return crate::router::json_error(format!("Failed to rotate session: {e}"), "INTERNAL_ERROR", &request_id, 500);
    }
    let _ = refresh_tokens::revoke(&db, &session::hash_token(&presented), &now.to_rfc3339()).await;

    let body = SessionResponse {
        staff_id: stored.subject_id,
        tenant_id: stored.tenant_id,
        location_id: stored.location_id,
        role: format!("{role:?}"),
        permissions,
        expires_in: usize::try_from(policy.access_ttl_secs).unwrap_or(0),
    };
    session_cookies_response(&body, &access_token, &refresh_token, policy)
}

/// Revokes the presented refresh session and clears both cookies.
///
/// # Errors
/// Returns an error only if the response envelope cannot be built.
pub async fn logout<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    if let Some(presented) = session::read_cookie(&req, session::REFRESH_COOKIE) {
        if let Ok(db) = ctx.env.d1("CELLAR_DB") {
            let _ = refresh_tokens::revoke(&db, &session::hash_token(&presented), &chrono::Utc::now().to_rfc3339()).await;
        }
    }
    clear_session_cookies(Response::from_json(&serde_json::json!({ "success": true }))?)
}

/// Revokes every session for the authenticated staff member ("logout everywhere").
///
/// # Errors
/// Returns the uniform rejection envelope when the caller is not authenticated.
pub async fn revoke_sessions<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let Ok(auth_context) = crate::auth::authorize(&req, &ctx, Permissions::empty()) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &request_id, 401);
    };
    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Authentication unavailable", "INTERNAL_ERROR", &request_id, 500);
    };
    if let Err(e) = refresh_tokens::revoke_all_for_subject(
        &db,
        &auth_context.tenant_id.to_string(),
        "staff",
        &auth_context.staff_id.to_string(),
        &chrono::Utc::now().to_rfc3339(),
    )
    .await
    {
        return crate::router::json_error(format!("Failed to revoke sessions: {e}"), "INTERNAL_ERROR", &request_id, 500);
    }
    clear_session_cookies(Response::from_json(&serde_json::json!({ "success": true }))?)
}

fn build_staff_claims(
    sub: String,
    tenant_id: String,
    location_id: String,
    role: String,
    permissions: u32,
    access_ttl_secs: i64,
) -> JwtClaims {
    let now_ts = usize::try_from(chrono::Utc::now().timestamp()).unwrap_or(0);
    let ttl = usize::try_from(access_ttl_secs).unwrap_or(0);
    JwtClaims {
        sub,
        iss: "plinth-auth".to_string(),
        exp: now_ts + ttl,
        tenant_id,
        location_id,
        roles: vec![role],
        permissions,
        token_type: "staff".to_string(),
    }
}

fn sign_claims(claims: &JwtClaims, secret: &str) -> std::result::Result<String, jsonwebtoken::errors::Error> {
    jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
}

async fn staff_identity_by_id(
    db: &worker::d1::D1Database,
    tenant_id: &str,
    location_id: &str,
    staff_id: &str,
) -> worker::Result<Option<(StaffRole, u32)>> {
    let row = db
        .prepare(
            "SELECT role, permissions FROM staff_members WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3 AND deleted_at IS NULL AND is_active = 1",
        )
        .bind(&[staff_id.into(), tenant_id.into(), location_id.into()])?
        .first::<serde_json::Value>(None)
        .await?;
    Ok(row.as_ref().map(|value| {
        let role = role_from_str(value.get("role").and_then(serde_json::Value::as_str));
        let permissions = value
            .get("permissions")
            .and_then(serde_json::Value::as_u64)
            .and_then(|raw| u32::try_from(raw).ok())
            .unwrap_or_else(|| role.default_permissions().bits());
        (role, permissions)
    }))
}

fn session_cookies_response<B: Serialize>(
    body: &B,
    access_token: &str,
    refresh_token: &str,
    policy: SessionPolicy,
) -> Result<Response> {
    let resp = Response::from_json(body)?;
    let resp = session::set_cookie(
        resp,
        &session::session_cookie(session::ACCESS_COOKIE, access_token, policy.access_ttl_secs),
    )?;
    session::set_cookie(
        resp,
        &session::session_cookie(session::REFRESH_COOKIE, refresh_token, policy.refresh_ttl_secs),
    )
}

fn clear_session_cookies(resp: Response) -> Result<Response> {
    let resp = session::set_cookie(resp, &session::cleared_cookie(session::ACCESS_COOKIE))?;
    session::set_cookie(resp, &session::cleared_cookie(session::REFRESH_COOKIE))
}

fn reject_rotation(err: RotationError, request_id: &str) -> Result<Response> {
    let resp = crate::router::json_error(err.to_string(), err.code(), request_id, 401)?;
    clear_session_cookies(resp)
}


#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::enums::staff::StaffRole;
    use core_domain::ids::StaffMemberId;

    fn hash_for_test(pin: &str) -> String {
        use argon2::password_hash::{PasswordHasher, SaltString};
        use rand_core::OsRng;
        Argon2::default()
            .hash_password(pin.as_bytes(), &SaltString::generate(&mut OsRng))
            .map(|h| h.to_string())
            .expect("test hash")
    }

    fn stored(role: &str, permissions: u64, pin: &str) -> StoredStaffIdentity {
        StoredStaffIdentity {
            role: Some(role.to_string()),
            permissions: Some(permissions),
            pin_hash: Some(hash_for_test(pin)),
        }
    }

    #[test]
    fn test_login_request_serde() {
        let req = LoginRequest {
            staff_id: StaffMemberId::new(),
            pin: "1234".to_string(),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("1234"));
        assert!(!json.contains("role"));
    }

    #[test]
    fn refuses_unknown_staff() {
        assert_eq!(
            resolve_login_identity(None, "1234"),
            Err(LoginRefusal::UnknownStaff)
        );
    }

    #[test]
    fn refuses_wrong_pin_and_missing_hash() {
        assert_eq!(
            resolve_login_identity(Some(stored("Manager", 1023, "1234")), "9999"),
            Err(LoginRefusal::InvalidPin)
        );
        assert_eq!(
            resolve_login_identity(
                Some(StoredStaffIdentity { role: Some("Manager".to_string()), permissions: Some(1023), pin_hash: None }),
                "1234"
            ),
            Err(LoginRefusal::InvalidPin)
        );
        assert_eq!(
            resolve_login_identity(
                Some(StoredStaffIdentity { role: Some("Manager".to_string()), permissions: Some(1023), pin_hash: Some(String::new()) }),
                "1234"
            ),
            Err(LoginRefusal::InvalidPin)
        );
    }

    #[test]
    fn accepts_correct_pin_with_stored_role_and_permissions() {
        let (role, permissions) = resolve_login_identity(Some(stored("Manager", 513, "1234")), "1234").expect("valid");
        assert!(matches!(role, StaffRole::Manager));
        assert_eq!(permissions, 513);
    }

    #[test]
    fn falls_back_safely_on_unknown_role_and_overflowing_permissions() {
        let (role, permissions) = resolve_login_identity(
            Some(StoredStaffIdentity {
                role: Some("Superuser".to_string()),
                permissions: Some(u64::MAX),
                pin_hash: Some(hash_for_test("1234")),
            }),
            "1234",
        )
        .expect("valid");
        assert!(matches!(role, StaffRole::Waiter));
        assert_eq!(permissions, StaffRole::Waiter.default_permissions().bits());
    }
}
