use crate::auth::JwtClaims;
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

/// Response returned upon successful authentication
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LoginResponse {
    pub token: String,
    pub customer: CustomerProfile,
    pub expires_in: usize,
}

/// Registers auth routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/customer-auth/register", register_customer)
        .post_async("/api/v1/customer-auth/login", login)
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
        return crate::router::json_error(format!("Failed to insert customer: {e}"), "INTERNAL_ERROR", &request_id, 500);
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
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &request_id, 500),
    };

    let Some(row) = row_opt else {
        let event_id = Uuid::now_v7().to_string();
        let now = Utc::now().to_rfc3339();
        if let Ok(stmt) = db.prepare(
            "INSERT INTO login_events (id, tenant_id, customer_id, channel, success, occurred_at) VALUES (?1, ?2, NULL, ?3, ?4, ?5)"
        ).bind(&[
            event_id.into(),
            payload.tenant_id.into(),
            "Web".into(),
            0.into(),
            now.into(),
        ]) {
            let _ = stmt.run().await;
        }

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

    let now_ts = usize::try_from(chrono::Utc::now().timestamp()).unwrap_or(0);
    let expires_in: usize = 86400 * 30; // 30 days for customers
    let exp = now_ts + expires_in;

    let claims = JwtClaims {
        sub: customer_id.clone(),
        iss: "plinth-auth".to_string(),
        exp,
        tenant_id: payload.tenant_id.clone(),
        location_id: location_id.clone(),
        roles: vec!["Customer".to_string()],
        permissions: 0,
    };

    let header = Header::new(Algorithm::HS256);
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("JWT secret not configured", "INTERNAL_ERROR", &request_id, 500);
    };
    let key = jsonwebtoken::EncodingKey::from_secret(secret.as_bytes());
    let token = match jsonwebtoken::encode(&header, &claims, &key) {
        Ok(t) => t,
        Err(e) => return crate::router::json_error(format!("Failed to sign token: {e}"), "INTERNAL_ERROR", &request_id, 500),
    };

    let profile = CustomerProfile {
        id: customer_id,
        tenant_id: payload.tenant_id,
        location_id,
        name,
        phone,
        email,
        loyalty_points,
    };

    let response_body = LoginResponse {
        token,
        customer: profile,
        expires_in,
    };

    Response::from_json(&response_body)
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
