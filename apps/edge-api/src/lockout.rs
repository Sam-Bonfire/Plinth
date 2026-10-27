use worker::{D1Database, Result};
use chrono::{Utc, Duration};

/// Checks if an identifier is locked out (>= 5 failed attempts in the last 15 minutes).
/// Returns `Ok(true)` if locked out, `Ok(false)` if allowed.
///
/// # Errors
/// Returns an error if the database query fails.
pub async fn is_locked_out(db: &D1Database, tenant_id: &str, identifier: &str) -> Result<bool> {
    let fifteen_mins_ago = (Utc::now() - Duration::minutes(15)).to_rfc3339();

    let sql = r"
        SELECT success FROM auth_attempts
        WHERE tenant_id = ? AND identifier = ? AND occurred_at >= ?
        ORDER BY occurred_at DESC
        LIMIT 5
    ";

    let stmt = db.prepare(sql).bind(&[
        tenant_id.into(),
        identifier.into(),
        fifteen_mins_ago.into()
    ])?;

    let rows: Vec<serde_json::Value> = stmt.all().await?.results()?;

    if rows.len() < 5 {
        return Ok(false);
    }

    for row in rows {
        if let Some(success) = row.get("success").and_then(serde_json::Value::as_i64) {
            if success != 0 {
                return Ok(false);
            }
        }
    }

    Ok(true)
}

/// Records an authentication attempt.
///
/// # Errors
/// Returns an error if the database insert fails.
pub async fn record_attempt(db: &D1Database, tenant_id: &str, identifier: &str, success: bool) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let id = uuid::Uuid::now_v7().to_string();
    let success_int = i32::from(success);

    let sql = "INSERT INTO auth_attempts (id, tenant_id, identifier, success, occurred_at) VALUES (?, ?, ?, ?, ?)";
    let stmt = db.prepare(sql).bind(&[
        id.into(),
        tenant_id.into(),
        identifier.into(),
        success_int.into(),
        now.into()
    ])?;

    stmt.run().await?;
    Ok(())
}
