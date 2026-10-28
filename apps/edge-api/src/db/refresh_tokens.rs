use worker::d1::D1Database;
use worker::Result;

/// One stored refresh session. `expires_at` and `revoked_at` are RFC3339
/// timestamps; `subject_type` is `staff` or `customer`.
#[derive(Debug, Clone)]
pub struct RefreshSession {
    pub id: String,
    pub tenant_id: String,
    pub location_id: String,
    pub subject_type: String,
    pub subject_id: String,
    pub expires_at: String,
    pub revoked_at: Option<String>,
}

fn to_session(row: &serde_json::Value) -> Option<RefreshSession> {
    let text = |key: &str| row.get(key).and_then(serde_json::Value::as_str).map(ToString::to_string);
    Some(RefreshSession {
        id: text("id")?,
        tenant_id: text("tenant_id")?,
        location_id: text("location_id")?,
        subject_type: text("subject_type")?,
        subject_id: text("subject_id")?,
        expires_at: text("expires_at")?,
        revoked_at: text("revoked_at"),
    })
}

/// Stores a freshly minted refresh session.
///
/// # Errors
/// Returns an error when D1 rejects the insert.
#[allow(clippy::too_many_arguments)]
pub async fn insert(
    db: &D1Database,
    tenant_id: &str,
    location_id: &str,
    subject_type: &str,
    subject_id: &str,
    token_hash: &str,
    expires_at: &str,
    created_at: &str,
) -> Result<()> {
    db.prepare(
        "INSERT INTO refresh_tokens (id, tenant_id, location_id, subject_type, subject_id, token_hash, expires_at, revoked_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8)",
    )
    .bind(&[
        uuid::Uuid::now_v7().to_string().into(),
        tenant_id.into(),
        location_id.into(),
        subject_type.into(),
        subject_id.into(),
        token_hash.into(),
        expires_at.into(),
        created_at.into(),
    ])?
    .run()
    .await?;
    Ok(())
}

/// Looks a session up by the hash of the presented token.
///
/// # Errors
/// Returns an error when the query fails.
pub async fn find_by_hash(db: &D1Database, token_hash: &str) -> Result<Option<RefreshSession>> {
    let row = db
        .prepare("SELECT id, tenant_id, location_id, subject_type, subject_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?1")
        .bind(&[token_hash.into()])?
        .first::<serde_json::Value>(None)
        .await?;
    Ok(row.as_ref().and_then(to_session))
}

/// Revokes one session. Revoking an already revoked session is a no-op.
///
/// # Errors
/// Returns an error when the update fails.
pub async fn revoke(db: &D1Database, token_hash: &str, revoked_at: &str) -> Result<()> {
    db.prepare("UPDATE refresh_tokens SET revoked_at = ?1 WHERE token_hash = ?2 AND revoked_at IS NULL")
        .bind(&[revoked_at.into(), token_hash.into()])?
        .run()
        .await?;
    Ok(())
}

/// Revokes every live session for one subject (logout everywhere).
///
/// # Errors
/// Returns an error when the update fails.
pub async fn revoke_all_for_subject(
    db: &D1Database,
    tenant_id: &str,
    subject_type: &str,
    subject_id: &str,
    revoked_at: &str,
) -> Result<()> {
    db.prepare(
        "UPDATE refresh_tokens SET revoked_at = ?1
         WHERE tenant_id = ?2 AND subject_type = ?3 AND subject_id = ?4 AND revoked_at IS NULL",
    )
    .bind(&[
        revoked_at.into(),
        tenant_id.into(),
        subject_type.into(),
        subject_id.into(),
    ])?
    .run()
    .await?;
    Ok(())
}
