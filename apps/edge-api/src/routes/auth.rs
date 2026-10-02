use crate::auth::JwtClaims;
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use core_domain::{
    enums::staff::StaffRole,
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

/// Response returned upon successful authentication
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginResponse {
    pub token: String,
    pub staff_id: StaffMemberId,
    pub role: StaffRole,
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
    let role = match stored.role.as_deref() {
        Some("Owner") => StaffRole::Owner,
        Some("Manager") => StaffRole::Manager,
        Some("Cashier") => StaffRole::Cashier,
        Some("Kitchen") => StaffRole::Kitchen,
        _ => StaffRole::Waiter,
    };
    let permissions = stored.permissions.and_then(|v| u32::try_from(v).ok()).unwrap_or_else(|| role.default_permissions().bits());
    Ok((role, permissions))
}

/// Registers auth routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/auth/login", login)
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
        return crate::router::json_error("Invalid staff ID or PIN", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let now_ts = usize::try_from(chrono::Utc::now().timestamp()).unwrap_or(0);
    let expires_in: usize = 86400; // 24 hours
    let exp = now_ts + expires_in;

    let claims = JwtClaims {
        sub: payload.staff_id.to_string(),
        iss: "plinth-auth".to_string(),
        exp,
        tenant_id: tenant_id_str,
        location_id: location_id_str,
        roles: vec![format!("{role:?}")],
        permissions,
    };

    let header = Header::new(Algorithm::HS256);
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    };
    let key = jsonwebtoken::EncodingKey::from_secret(secret.as_bytes());
    let token = match jsonwebtoken::encode(&header, &claims, &key) {
        Ok(t) => t,
        Err(e) => return crate::router::json_error(format!("Failed to sign token: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    let response_body = LoginResponse {
        token,
        staff_id: payload.staff_id,
        role,
        permissions,
        expires_in,
    };

    Response::from_json(&response_body)
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
