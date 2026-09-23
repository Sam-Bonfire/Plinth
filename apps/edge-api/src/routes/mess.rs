
use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MessTopUpRequest {
    pub account_id: String,
    pub amount_minor: i64,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MessPayRequest {
    pub account_id: String,
    pub amount_minor: i64,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MessBalanceResponse {
    pub account_id: String,
    pub balance_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MessLedgerResponse {
    pub success: bool,
    pub entry_id: String,
}

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/mess/topup", top_up)
        .post_async("/api/v1/mess/pay", pay)
        .get_async("/api/v1/mess/accounts/:id/balance", get_balance)
}

/// Handle top up
///
/// # Errors
/// Returns error if validation fails
pub async fn top_up<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, &secret, Permissions::empty()) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let Ok(payload) = req.json::<MessTopUpRequest>().await else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    if payload.amount_minor <= 0 {
        return crate::router::json_error("Amount must be positive", "INVALID_AMOUNT", &crate::router::get_request_id(&req), 400);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    // Verify account belongs to tenant
    let check_sql = "SELECT id FROM mess_accounts WHERE id = ? AND tenant_id = ?";
    let check_params: Vec<JsValue> = vec![payload.account_id.clone().into(), tenant_ctx.tenant_id.to_string().into()];
    let check_stmt = db.prepare(check_sql).bind(&check_params)?;
    if check_stmt.first::<serde_json::Value>(Some("id")).await?.is_none() {
        return crate::router::json_error("Account not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }

    let entry_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let sql = "INSERT INTO mess_ledger_entries (id, account_id, debit_minor, credit_minor, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)";
    let params: Vec<JsValue> = vec![
        entry_id.clone().into(),
        payload.account_id.into(),
        0.into(),
        payload.amount_minor.into(),
        payload.memo.map_or(JsValue::null(), std::convert::Into::into),
        now.into(),
    ];

    let stmt = db.prepare(sql).bind(&params)?;
    let _ = stmt.run().await?;

    let res_dto = MessLedgerResponse {
        success: true,
        entry_id,
    };

    Response::from_json(&res_dto).map(|r| r.with_status(202))
}

/// Handle payment
///
/// # Errors
/// Returns error if validation fails
pub async fn pay<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, &secret, Permissions::empty()) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let Ok(payload) = req.json::<MessPayRequest>().await else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    if payload.amount_minor <= 0 {
        return crate::router::json_error("Amount must be positive", "INVALID_AMOUNT", &crate::router::get_request_id(&req), 400);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    // Verify account belongs to tenant
    let check_sql = "SELECT id FROM mess_accounts WHERE id = ? AND tenant_id = ?";
    let check_params: Vec<JsValue> = vec![payload.account_id.clone().into(), tenant_ctx.tenant_id.to_string().into()];
    let check_stmt = db.prepare(check_sql).bind(&check_params)?;
    if check_stmt.first::<serde_json::Value>(Some("id")).await?.is_none() {
        return crate::router::json_error("Account not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }

    // Calculate balance
    let balance_sql = "SELECT SUM(credit_minor - debit_minor) as balance FROM mess_ledger_entries WHERE account_id = ?";
    let balance_params: Vec<JsValue> = vec![payload.account_id.clone().into()];
    let balance_stmt = db.prepare(balance_sql).bind(&balance_params)?;
    let result = balance_stmt.first::<serde_json::Value>(Some("balance")).await?;
    let current_balance = match result {
        Some(val) => val.as_i64().unwrap_or(0),
        None => 0,
    };

    if current_balance < payload.amount_minor {
        return crate::router::json_error("Insufficient funds", "INSUFFICIENT_FUNDS", &crate::router::get_request_id(&req), 409);
    }

    let entry_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let sql = "INSERT INTO mess_ledger_entries (id, account_id, debit_minor, credit_minor, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)";
    let params: Vec<JsValue> = vec![
        entry_id.clone().into(),
        payload.account_id.into(),
        payload.amount_minor.into(),
        0.into(),
        payload.memo.map_or(JsValue::null(), std::convert::Into::into),
        now.into(),
    ];

    let stmt = db.prepare(sql).bind(&params)?;
    let _ = stmt.run().await?;

    let res_dto = MessLedgerResponse {
        success: true,
        entry_id,
    };

    Response::from_json(&res_dto).map(|r| r.with_status(202))
}

/// Get balance
///
/// # Errors
/// Returns error if DB fails
pub async fn get_balance<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, &secret, Permissions::empty()) else {
        return crate::router::json_error("Unauthorized", "UNAUTHORIZED", &crate::router::get_request_id(&req), 401);
    };

    let account_id = match ctx.param("id") {
        Some(id) => id.clone(),
        None => return crate::router::json_error("Missing account ID", "INVALID_PARAM", &crate::router::get_request_id(&req), 400),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };

    // Verify account belongs to tenant
    let check_sql = "SELECT id FROM mess_accounts WHERE id = ? AND tenant_id = ?";
    let check_params: Vec<JsValue> = vec![account_id.clone().into(), tenant_ctx.tenant_id.to_string().into()];
    let check_stmt = db.prepare(check_sql).bind(&check_params)?;
    if check_stmt.first::<serde_json::Value>(Some("id")).await?.is_none() {
        return crate::router::json_error("Account not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }

    let sql = "SELECT SUM(credit_minor - debit_minor) as balance FROM mess_ledger_entries WHERE account_id = ?";
    let params: Vec<JsValue> = vec![account_id.clone().into()];
    let stmt = db.prepare(sql).bind(&params)?;

    let result = stmt.first::<serde_json::Value>(Some("balance")).await?;
    let current_balance = match result {
        Some(val) => {
            if val.is_null() {
                0
            } else {
                val.as_i64().unwrap_or(0)
            }
        },
        None => 0,
    };

    let res_dto = MessBalanceResponse {
        account_id,
        balance_minor: current_balance,
    };

    Response::from_json(&res_dto)
}

#[cfg(test)]
mod tests {
    // use super::*;

    #[test]
    fn test_balance_math() {
        let credits = vec![1000, 500, 250];
        let debits = vec![200, 150];
        let total_credits: i64 = credits.iter().sum();
        let total_debits: i64 = debits.iter().sum();
        let balance = total_credits - total_debits;
        assert_eq!(balance, 1400);
    }
}
