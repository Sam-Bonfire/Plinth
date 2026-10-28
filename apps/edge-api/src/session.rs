use crate::db::refresh_tokens::RefreshSession;
use chrono::{DateTime, Duration, Utc};
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};
use worker::{Request, Response, Result, RouteContext};

/// Cookie carrying the short-lived access token.
pub const ACCESS_COOKIE: &str = "plinth_access";
/// Cookie carrying the rotating refresh token.
pub const REFRESH_COOKIE: &str = "plinth_refresh";

/// Access tokens are deliberately short: a stolen cookie is useless in minutes.
pub const ACCESS_TTL_SECS: i64 = 15 * 60;
const DEFAULT_STAFF_REFRESH_TTL_SECS: i64 = 7 * 24 * 60 * 60;
const DEFAULT_CUSTOMER_REFRESH_TTL_SECS: i64 = 30 * 24 * 60 * 60;

/// How long a freshly issued session stays valid.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionPolicy {
    pub access_ttl_secs: i64,
    pub refresh_ttl_secs: i64,
}

impl SessionPolicy {
    /// Staff sessions: short access token, operator-configurable refresh window.
    #[must_use]
    pub fn staff<D>(ctx: &RouteContext<D>) -> Self {
        Self {
            access_ttl_secs: ACCESS_TTL_SECS,
            refresh_ttl_secs: env_secs(ctx, "STAFF_REFRESH_TTL_SECS", DEFAULT_STAFF_REFRESH_TTL_SECS),
        }
    }

    /// Customer sessions: same short access token, longer refresh window.
    #[must_use]
    pub fn customer<D>(ctx: &RouteContext<D>) -> Self {
        Self {
            access_ttl_secs: ACCESS_TTL_SECS,
            refresh_ttl_secs: env_secs(ctx, "CUSTOMER_REFRESH_TTL_SECS", DEFAULT_CUSTOMER_REFRESH_TTL_SECS),
        }
    }

    #[must_use]
    pub fn refresh_expiry(&self) -> DateTime<Utc> {
        Utc::now() + Duration::seconds(self.refresh_ttl_secs)
    }
}

fn env_secs<D>(ctx: &RouteContext<D>, key: &str, default: i64) -> i64 {
    ctx.env
        .var(key)
        .ok()
        .and_then(|value| value.to_string().parse::<i64>().ok())
        .filter(|secs| *secs > 0)
        .unwrap_or(default)
}

/// Reads one cookie value out of a raw `Cookie` header.
#[must_use]
pub fn cookie_value(header: Option<&str>, name: &str) -> Option<String> {
    header?
        .split(';')
        .filter_map(|part| part.trim().split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// Reads one cookie value from the request's `Cookie` header.
#[must_use]
pub fn read_cookie(req: &Request, name: &str) -> Option<String> {
    cookie_value(req.headers().get("Cookie").ok().flatten().as_deref(), name)
}

/// Serialises one session cookie. `SameSite=None` is required because the
/// edge API, dashboard, POS and portal are separate origins; the allowlisted
/// CORS origin check plus `HttpOnly` keeps it out of reach of page scripts.
#[must_use]
pub fn session_cookie(name: &str, value: &str, max_age_secs: i64) -> String {
    format!("{name}={value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age={max_age_secs}")
}

/// Serialises the deletion of one cookie.
#[must_use]
pub fn cleared_cookie(name: &str) -> String {
    format!("{name}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0")
}

/// Hashes a refresh token before it ever reaches storage.
#[must_use]
pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Mints an opaque refresh token (256 bits of OS randomness).
#[must_use]
pub fn new_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Appends a `Set-Cookie` header without disturbing the response body.
///
/// # Errors
/// Returns an error when the response headers reject the value.
pub fn set_cookie(mut resp: Response, header: &str) -> Result<Response> {
    resp.headers_mut().append("Set-Cookie", header)?;
    Ok(resp)
}

/// Why a presented refresh token cannot be rotated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RotationError {
    /// No matching session row.
    Invalid,
    /// The refresh window has passed.
    Expired,
    /// The token was already rotated or revoked: treat as theft.
    Revoked,
}

impl RotationError {
    /// Stable error code so clients can tell expiry from revocation.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::Invalid => "SESSION_INVALID",
            Self::Expired => "SESSION_EXPIRED",
            Self::Revoked => "SESSION_REVOKED",
        }
    }
}

impl std::fmt::Display for RotationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::Invalid => "Session not found",
            Self::Expired => "Session expired",
            Self::Revoked => "Session revoked",
        };
        f.write_str(message)
    }
}

/// Pure rotation decision for one presented refresh token.
///
/// # Errors
/// Returns `Invalid` when the row is absent, `Revoked` when it was already
/// rotated, and `Expired` when its window has passed.
pub fn check_rotation(session: Option<&RefreshSession>, now: DateTime<Utc>) -> std::result::Result<(), RotationError> {
    let Some(session) = session else {
        return Err(RotationError::Invalid);
    };
    if session.revoked_at.is_some() {
        return Err(RotationError::Revoked);
    }
    let expires_at = DateTime::parse_from_rfc3339(&session.expires_at)
        .map_err(|_| RotationError::Invalid)?
        .with_timezone(&Utc);
    if expires_at <= now {
        return Err(RotationError::Expired);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(expires_at: DateTime<Utc>, revoked: bool) -> RefreshSession {
        RefreshSession {
            id: "session".to_string(),
            tenant_id: "tenant".to_string(),
            location_id: "location".to_string(),
            subject_type: "staff".to_string(),
            subject_id: "staff".to_string(),
            expires_at: expires_at.to_rfc3339(),
            revoked_at: revoked.then(|| Utc::now().to_rfc3339()),
        }
    }

    #[test]
    fn missing_session_is_invalid() {
        assert_eq!(check_rotation(None, Utc::now()), Err(RotationError::Invalid));
    }

    #[test]
    fn revoked_session_wins_over_future_expiry() {
        let live = session(Utc::now() + Duration::minutes(5), false);
        assert_eq!(check_rotation(Some(&live), Utc::now()), Ok(()));
        let revoked = session(Utc::now() + Duration::minutes(5), true);
        assert_eq!(check_rotation(Some(&revoked), Utc::now()), Err(RotationError::Revoked));
    }

    #[test]
    fn expired_session_reports_distinctly() {
        let expired = session(Utc::now() - Duration::seconds(1), false);
        assert_eq!(check_rotation(Some(&expired), Utc::now()), Err(RotationError::Expired));
    }

    #[test]
    fn codes_are_stable_and_distinct() {
        assert_eq!(RotationError::Invalid.code(), "SESSION_INVALID");
        assert_eq!(RotationError::Expired.code(), "SESSION_EXPIRED");
        assert_eq!(RotationError::Revoked.code(), "SESSION_REVOKED");
    }

    #[test]
    fn cookies_are_http_only_secure_and_clearable() {
        let cookie = session_cookie(ACCESS_COOKIE, "token", 900);
        assert!(cookie.starts_with("plinth_access=token;"));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.contains("SameSite=None"));
        assert!(cookie.contains("Max-Age=900"));
        assert!(cleared_cookie(REFRESH_COOKIE).contains("Max-Age=0"));
    }

    #[test]
    fn hash_is_stable_and_not_the_token() {
        let token = "refresh-token-value";
        assert_eq!(hash_token(token), hash_token(token));
        assert_ne!(hash_token(token), token);
        assert_eq!(hash_token(token).len(), 64);
    }

    #[test]
    fn refresh_tokens_are_unique() {
        assert_ne!(new_refresh_token(), new_refresh_token());
    }

    #[test]
    fn reads_only_the_named_cookie() {
        let header = "a=1; plinth_access=abc; plinth_refresh=def";
        assert_eq!(cookie_value(Some(header), ACCESS_COOKIE).as_deref(), Some("abc"));
        assert_eq!(cookie_value(Some(header), REFRESH_COOKIE).as_deref(), Some("def"));
        assert!(cookie_value(Some(header), "missing").is_none());
        assert!(cookie_value(None, ACCESS_COOKIE).is_none());
        assert!(cookie_value(Some("plinth_access="), ACCESS_COOKIE).is_none());
    }
}
