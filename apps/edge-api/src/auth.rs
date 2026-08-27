use crate::context::TenantContext;
use core_domain::enums::staff::Permissions;
use core_domain::ids::{LocationId, StaffMemberId, TenantId};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use worker::Request;
use uuid::Uuid;
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String, // Staff ID
    pub iss: String,
    pub exp: usize,
    pub tenant_id: String,
    pub location_id: String,
    pub roles: Vec<String>,
    pub permissions: u32,
}

#[must_use]
pub fn extract_token_from_header(auth_header: Option<&String>) -> Option<String> {
    auth_header.and_then(|h| h.strip_prefix("Bearer ").map(std::string::ToString::to_string))
}

#[must_use]
pub fn extract_token(req: &Request) -> Option<String> {
    let header = req.headers().get("Authorization").ok().flatten();
    extract_token_from_header(header.as_ref())
}

/// Verifies a JWT token
///
/// # Errors
/// Returns an error if the token is invalid or parsing fails
pub fn verify_token(token: &str, secret: &str) -> std::result::Result<JwtClaims, String> {
    let is_pem = secret.starts_with("-----");
    let alg = if is_pem { Algorithm::EdDSA } else { Algorithm::HS256 };
    let mut validation = Validation::new(alg);
    validation.validate_exp = true;

    // Validate the issuer claim
    let mut issuers = HashSet::new();
    issuers.insert("plinth-auth".to_string());
    issuers.insert("plinth-edge".to_string());
    validation.iss = Some(issuers);

    let key = if is_pem {
        DecodingKey::from_ed_pem(secret.as_bytes()).map_err(|e| e.to_string())?
    } else {
        DecodingKey::from_secret(secret.as_bytes())
    };

    let token_data = decode::<JwtClaims>(token, &key, &validation)
        .map_err(|e| format!("{:?}", e.kind()))?;

    Ok(token_data.claims)
}

/// Verifies context using header fields directly
///
/// # Errors
/// Returns an error if any required header is missing or mismatch
pub fn verify_context_from_headers(
    header_tenant_id: Option<String>,
    header_location_id: Option<String>,
    auth_header: Option<&String>,
    secret: &str,
    required_permissions: Permissions,
) -> std::result::Result<TenantContext, String> {
    let header_tenant_id = header_tenant_id.ok_or_else(|| "Missing x-tenant-id header".to_string())?;
    let header_location_id = header_location_id.ok_or_else(|| "Missing x-location-id header".to_string())?;

    let token = extract_token_from_header(auth_header).ok_or_else(|| "Missing Authorization header".to_string())?;

    let claims = verify_token(&token, secret)?;

    if claims.tenant_id != header_tenant_id {
        return Err("Tenant ID mismatch".to_string());
    }
    if claims.location_id != header_location_id {
        return Err("Location ID mismatch".to_string());
    }

    let claims_permissions = Permissions::from_bits_truncate(claims.permissions);
    if !claims_permissions.contains(required_permissions) {
        return Err("Insufficient permissions".to_string());
    }

    let tenant_id = TenantId::from(Uuid::parse_str(&claims.tenant_id).map_err(|_| "Invalid Tenant ID".to_string())?);
    let location_id = LocationId::from(Uuid::parse_str(&claims.location_id).map_err(|_| "Invalid Location ID".to_string())?);
    let staff_id = StaffMemberId::from(Uuid::parse_str(&claims.sub).map_err(|_| "Invalid Staff ID".to_string())?);

    Ok(TenantContext {
        tenant_id,
        location_id,
        staff_id,
        permissions: claims_permissions,
    })
}

/// Extracts and verifies context from a request
///
/// # Errors
/// Returns an error if the context cannot be verified from the request
pub fn extract_and_verify_context(
    req: &Request,
    secret: &str,
    required_permissions: Permissions,
) -> std::result::Result<TenantContext, String> {
    let header_tenant_id = req.headers().get("x-tenant-id").ok().flatten();
    let header_location_id = req.headers().get("x-location-id").ok().flatten();
    let auth_header = req.headers().get("Authorization").ok().flatten();

    verify_context_from_headers(
        header_tenant_id,
        header_location_id,
        auth_header.as_ref(),
        secret,
        required_permissions
    )
}
