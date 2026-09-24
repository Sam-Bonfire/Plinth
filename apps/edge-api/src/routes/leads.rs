use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{Request, Response, Result, RouteContext, Router};
use chrono::Utc;

/// Trial-request lead submitted from the marketing site.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LeadRequest {
    pub name: String,
    pub phone: String,
    pub outlets: i64,
    pub city: String,
}

/// Accepted lead receipt.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LeadResponse {
    pub lead_id: String,
}

/// Validates a lead payload, returning the normalized phone on success.
///
/// # Errors
/// Returns a message if the name/city is blank, outlets < 1, or the phone
/// has no 7-15 digits after stripping formatting.
pub fn validate_lead(payload: &LeadRequest) -> std::result::Result<String, &'static str> {
    if payload.name.trim().is_empty() {
        return Err("Name cannot be empty");
    }
    if payload.city.trim().is_empty() {
        return Err("City cannot be empty");
    }
    if payload.outlets < 1 {
        return Err("Outlets must be at least 1");
    }
    let stripped: String = payload
        .phone
        .chars()
        .filter(|c| *c != ' ' && *c != '-' && *c != '(' && *c != ')')
        .collect();
    let digits = stripped.strip_prefix('+').unwrap_or(&stripped);
    if !digits.chars().all(|c| c.is_ascii_digit()) || !(7..=15).contains(&digits.len()) {
        return Err("Invalid phone number format");
    }
    Ok(stripped)
}

/// Registers marketing routing endpoints.
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/marketing/leads", submit_lead)
}

/// Accepts a trial-request lead.
///
/// # Errors
/// Returns an error if the payload is invalid or the database write fails.
pub async fn submit_lead<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let request_id = crate::router::get_request_id(&req);
    let payload: LeadRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &request_id, 400),
    };

    let phone = match validate_lead(&payload) {
        Ok(p) => p,
        Err(msg) => return crate::router::json_error(msg, "INVALID_PAYLOAD", &request_id, 400),
    };

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        return crate::router::json_error("Database error", "INTERNAL_ERROR", &request_id, 500);
    };

    let lead_id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();

    let Ok(stmt) = db
        .prepare("INSERT INTO marketing_leads (id, name, phone, outlets, city, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(&[
            lead_id.clone().into(),
            payload.name.trim().to_string().into(),
            phone.into(),
            payload.outlets.into(),
            payload.city.trim().to_string().into(),
            now.into(),
        ])
    else {
        return crate::router::json_error("Database binding error", "INTERNAL_ERROR", &request_id, 500);
    };

    if let Err(e) = stmt.run().await {
        return crate::router::json_error(format!("Failed to store lead: {e}"), "INTERNAL_ERROR", &request_id, 500);
    }

    match Response::from_json(&LeadResponse { lead_id }) {
        Ok(resp) => Ok(resp.with_status(202)),
        Err(e) => crate::router::json_error(format!("JSON error: {e}"), "INTERNAL_ERROR", &request_id, 500),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lead() -> LeadRequest {
        LeadRequest {
            name: "Asha Rao".to_string(),
            phone: "+91 98200 12345".to_string(),
            outlets: 2,
            city: "Bengaluru".to_string(),
        }
    }

    #[test]
    fn accepts_valid_lead_with_normalized_phone() {
        assert_eq!(validate_lead(&lead()), Ok("+919820012345".to_string()));
    }

    #[test]
    fn rejects_blank_name_and_city() {
        assert_eq!(validate_lead(&LeadRequest { name: "  ".to_string(), ..lead() }), Err("Name cannot be empty"));
        assert_eq!(validate_lead(&LeadRequest { city: "".to_string(), ..lead() }), Err("City cannot be empty"));
    }

    #[test]
    fn rejects_bad_phone_and_outlets() {
        assert_eq!(validate_lead(&LeadRequest { phone: "123".to_string(), ..lead() }), Err("Invalid phone number format"));
        assert_eq!(validate_lead(&LeadRequest { outlets: 0, ..lead() }), Err("Outlets must be at least 1"));
    }
}
