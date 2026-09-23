use serde::{Deserialize, Serialize};

/// Customer directory row (mirrors the `customers` D1 table).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomerRow {
    pub id: String,
    pub tenant_id: String,
    pub location_id: String,
    pub name: String,
    pub phone: String,
    pub email: Option<String>,
    pub loyalty_points: i64,
    pub created_at: String,
    pub deleted_at: Option<String>,
}

/// Login event row (mirrors `login_events`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LoginEventRow {
    pub id: String,
    pub tenant_id: String,
    pub customer_id: Option<String>,
    pub channel: String,
    pub success: bool,
    pub occurred_at: String,
}

/// Parses a customer row from a D1 JSON value.
///
/// # Errors
/// Returns an error describing the first missing or mistyped field.
pub fn parse_customer(value: &serde_json::Value) -> Result<CustomerRow, String> {
    let get = |key: &str| {
        value
            .get(key)
            .and_then(|v| v.as_str())
            .map(String::from)
            .ok_or_else(|| format!("customers.{key} missing or not a string"))
    };
    Ok(CustomerRow {
        id: get("id")?,
        tenant_id: get("tenant_id")?,
        location_id: get("location_id")?,
        name: get("name")?,
        phone: get("phone")?,
        email: value.get("email").and_then(|v| v.as_str()).map(String::from),
        loyalty_points: value.get("loyalty_points").and_then(|v| v.as_i64()).unwrap_or(0),
        created_at: get("created_at")?,
        deleted_at: value.get("deleted_at").and_then(|v| v.as_str()).map(String::from),
    })
}

/// Parses a login event row from a D1 JSON value.
///
/// # Errors
/// Returns an error describing the first missing or mistyped field.
pub fn parse_login_event(value: &serde_json::Value) -> Result<LoginEventRow, String> {
    let get = |key: &str| {
        value
            .get(key)
            .and_then(|v| v.as_str())
            .map(String::from)
            .ok_or_else(|| format!("login_events.{key} missing or not a string"))
    };
    Ok(LoginEventRow {
        id: get("id")?,
        tenant_id: get("tenant_id")?,
        customer_id: value.get("customer_id").and_then(|v| v.as_str()).map(String::from),
        channel: get("channel")?,
        success: value.get("success").and_then(|v| v.as_i64()).unwrap_or(1) != 0,
        occurred_at: get("occurred_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn customer_json() -> serde_json::Value {
        json!({
            "id": "c-1",
            "tenant_id": "t-1",
            "location_id": "l-1",
            "name": "Asha",
            "phone": "+919820012345",
            "email": "asha@example.com",
            "loyalty_points": 120,
            "created_at": "2026-09-22T10:00:00Z",
            "deleted_at": null
        })
    }

    #[test]
    fn parses_customer_row() {
        let row = parse_customer(&customer_json()).expect("parse");
        assert_eq!(row.name, "Asha");
        assert_eq!(row.loyalty_points, 120);
        assert_eq!(row.email.as_deref(), Some("asha@example.com"));
    }

    #[test]
    fn rejects_customer_missing_id() {
        let mut v = customer_json();
        v.as_object_mut().expect("object").remove("id");
        assert!(parse_customer(&v).is_err());
    }

    #[test]
    fn parses_login_event_with_optional_customer() {
        let row = parse_login_event(&json!({
            "id": "e-1",
            "tenant_id": "t-1",
            "customer_id": null,
            "channel": "portal",
            "success": 0,
            "occurred_at": "2026-09-22T10:05:00Z"
        }))
        .expect("parse");
        assert!(!row.success);
        assert!(row.customer_id.is_none());
    }

    #[test]
    fn rejects_login_event_missing_channel() {
        let mut v = json!({
            "id": "e-1",
            "tenant_id": "t-1",
            "customer_id": "c-1",
            "channel": "portal",
            "success": 1,
            "occurred_at": "2026-09-22T10:05:00Z"
        });
        v.as_object_mut().expect("object").remove("channel");
        assert!(parse_login_event(&v).is_err());
    }
}
