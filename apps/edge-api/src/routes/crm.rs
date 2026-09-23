use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

/// Masked customer profile for CRM listing
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CrmCustomerDto {
    pub id: String,
    pub name: String,
    pub phone_masked: String,
    pub email_masked: Option<String>,
    pub loyalty_points: i64,
}

/// Masks a phone number, keeping the last 4 digits visible.
#[must_use]
pub fn mask_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() <= 4 {
        return "••••".to_string();
    }
    let (head, tail) = digits.split_at(digits.len() - 4);
    let masked_head: String = head.chars().map(|c| if c == '+' { '+' } else { '•' }).collect();
    format!("{masked_head} {tail}")
}

/// Masks an email address, keeping the first letter and domain visible.
#[must_use]
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first = local.chars().next().unwrap_or('*');
            format!("{first}***@{domain}")
        }
        None => "***".to_string(),
    }
}

/// Registers the CRM gateway route
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/api/v1/crm/customers", search_customers)
}

/// Searches tenant customers with masked contact details.
///
/// # Errors
/// Returns an error if authentication fails or database reads fail
pub async fn search_customers<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return Response::error("Unauthorized", 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return Response::error("Unauthorized", 401);
    };

    let url = req.url()?;
    let query = url
        .query_pairs()
        .find(|(k, _)| k == "q")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default();

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let like = format!("%{query}%");
    let params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        like.clone().into(),
        like.into(),
    ];
    let stmt = db
        .prepare(
            "SELECT id, name, phone, email, loyalty_points FROM customers WHERE tenant_id = ?1 AND deleted_at IS NULL AND (name LIKE ?2 OR phone LIKE ?3) ORDER BY name LIMIT 50",
        )
        .bind(&params)?;
    let rows = stmt.run().await?;
    let result: Vec<serde_json::Value> = rows.results()?;

    let customers: Vec<CrmCustomerDto> = result
        .iter()
        .filter_map(|row| {
            Some(CrmCustomerDto {
                id: row.get("id")?.as_str()?.to_string(),
                name: row.get("name")?.as_str()?.to_string(),
                phone_masked: mask_phone(row.get("phone")?.as_str()?),
                email_masked: row.get("email").and_then(|v| v.as_str()).map(mask_email),
                loyalty_points: row.get("loyalty_points")?.as_i64().unwrap_or(0),
            })
        })
        .collect();

    Response::from_json(&customers)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_phone_keeping_last_four() {
        assert_eq!(mask_phone("+919820012345"), "•••••••• 2345");
    }

    #[test]
    fn masks_short_phone_fully() {
        assert_eq!(mask_phone("123"), "••••");
    }

    #[test]
    fn masks_email_keeping_domain() {
        assert_eq!(mask_email("asha@example.com"), "a***@example.com");
        assert_eq!(mask_email("not-an-email"), "***");
    }
}
