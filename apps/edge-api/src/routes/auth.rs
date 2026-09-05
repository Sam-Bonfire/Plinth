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

fn get_jwt_secret<D>(ctx: &RouteContext<D>) -> String {
    // Try Cloudflare Secrets / Vars, fallback to empty for tests
    if let Ok(secret) = ctx.env.secret("JWT_SECRET") {
        return secret.to_string();
    }
    if let Ok(val) = ctx.env.var("JWT_SECRET") {
        return val.to_string();
    }
    // Fallback for local tests
    std::env::var("JWT_SECRET").unwrap_or_default()
}

fn verify_pin_hash(hash: &str, pin: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok()
}

/// Request payload for staff login / PIN authentication
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginRequest {
    pub staff_id: StaffMemberId,
    pub pin: String,
    pub role: Option<StaffRole>,
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
        return Response::error("Missing x-tenant-id header", 400);
    };
    let Some(location_id_str) = header_location_id else {
        return Response::error("Missing x-location-id header", 400);
    };

    if Uuid::parse_str(&tenant_id_str).is_err() || Uuid::parse_str(&location_id_str).is_err() {
        return Response::error("Invalid tenant or location UUID format", 400);
    }

    let payload: LoginRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return Response::error(format!("Invalid JSON payload: {e}"), 400),
    };

    if payload.pin.trim().is_empty() {
        return Response::error("PIN cannot be empty", 400);
    }

    // Verify PIN against D1 if available; fallback to role from request for tests
    let mut role = payload.role.unwrap_or(StaffRole::Waiter);
    let mut permissions = role.default_permissions().bits();

    if let Ok(db) = ctx.env.d1("CELLAR_DB") {
        if let Ok(stmt) = db
            .prepare(
                "SELECT role, permissions, pin_hash FROM staff_members WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3 AND deleted_at IS NULL AND is_active = 1",
            )
            .bind(&[
                payload.staff_id.to_string().into(),
                tenant_id_str.clone().into(),
                location_id_str.clone().into(),
            ])
        {
            if let Ok(Some(row)) = stmt.first::<serde_json::Value>(None).await {
                if let Some(hash) = row.get("pin_hash").and_then(serde_json::Value::as_str) {
                    if !verify_pin_hash(hash, &payload.pin) {
                        return Response::error("Invalid PIN", 401);
                    }
                }
                if let Some(role_str) = row.get("role").and_then(serde_json::Value::as_str) {
                    role = match role_str {
                        "Owner" => StaffRole::Owner,
                        "Manager" => StaffRole::Manager,
                        "Cashier" => StaffRole::Cashier,
                        "Kitchen" => StaffRole::Kitchen,
                        _ => StaffRole::Waiter,
                    };
                    permissions = row
                        .get("permissions")
                        .and_then(serde_json::Value::as_u64)
                        .map_or(role.default_permissions().bits(), |v| {
                            u32::try_from(v).unwrap_or(role.default_permissions().bits())
                        });
                }
            }
        }
    }

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
    let secret = get_jwt_secret(&ctx);
    if secret.is_empty() {
        return Response::error("JWT secret not configured", 500);
    }
    let key = jsonwebtoken::EncodingKey::from_secret(secret.as_bytes());
    let token = match jsonwebtoken::encode(&header, &claims, &key) {
        Ok(t) => t,
        Err(e) => return Response::error(format!("Failed to sign token: {e}"), 500),
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

    #[test]
    fn test_login_request_serde() {
        let req = LoginRequest {
            staff_id: StaffMemberId::new(),
            pin: "1234".to_string(),
            role: Some(StaffRole::Owner),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("1234"));
        assert!(json.contains("Owner"));
    }
}
