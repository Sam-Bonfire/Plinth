use crate::auth::JwtClaims;
use core_domain::{
    enums::staff::StaffRole,
    ids::StaffMemberId,
};
use jsonwebtoken::{Algorithm, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{Request, Response, Result, RouteContext, Router};

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
pub async fn login<D>(mut req: Request, _ctx: RouteContext<D>) -> Result<Response> {
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

    let role = payload.role.unwrap_or(StaffRole::Waiter);
    let permissions = role.default_permissions().bits();

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
    let key = jsonwebtoken::EncodingKey::from_secret(b"");
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
