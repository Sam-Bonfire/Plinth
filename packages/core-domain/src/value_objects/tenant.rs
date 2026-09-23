use std::net::IpAddr;
use thiserror::Error;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct TenantSlug(String);

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum TenantSlugError {
    #[error("Tenant slug must be between 3 and 63 characters")]
    InvalidLength,
    #[error("Tenant slug must contain only lowercase alphanumeric characters and hyphens")]
    InvalidCharacters,
    #[error("Tenant slug cannot start or end with a hyphen")]
    LeadingOrTrailingHyphen,
}

impl TenantSlug {
    /// Creates a new `TenantSlug`.
    ///
    /// # Errors
    ///
    /// Returns `TenantSlugError` if the slug is invalid (length, characters, or leading/trailing hyphens).
    pub fn new(slug: String) -> Result<Self, TenantSlugError> {
        if slug.len() < 3 || slug.len() > 63 {
            return Err(TenantSlugError::InvalidLength);
        }

        if slug.starts_with('-') || slug.ends_with('-') {
            return Err(TenantSlugError::LeadingOrTrailingHyphen);
        }

        if !slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            return Err(TenantSlugError::InvalidCharacters);
        }

        Ok(Self(slug))
    }

    #[must_use]
    pub fn into_inner(self) -> String {
        self.0
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub struct SubdomainTenant;

impl SubdomainTenant {
    #[must_use]
    pub fn extract_slug(host: &str) -> Option<String> {
        // Strip port if present
        let host_without_port = host.split(':').next().unwrap_or(host);

        // Lowercase
        let host_lower = host_without_port.to_lowercase();

        // Reject localhost and IP addresses
        if host_lower == "localhost" || host_lower.parse::<IpAddr>().is_ok() {
            return None;
        }

        // IPv6 can sometimes have brackets, though shouldn't after port stripping
        if host_lower.starts_with('[') && host_lower.ends_with(']') {
            return None;
        }

        // Extract first label
        let parts: Vec<&str> = host_lower.split('.').collect();

        if parts.len() < 2 {
            return None; // e.g. just "example" (unlikely for a valid host but just in case)
        }

        let slug = parts[0];

        // Return valid looking slug
        if slug.is_empty() {
            None
        } else {
            Some(slug.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_slug_valid() {
        assert!(TenantSlug::new("abc".to_string()).is_ok());
        assert!(TenantSlug::new("a1b-2c".to_string()).is_ok());
        assert!(TenantSlug::new("a".repeat(63)).is_ok());
    }

    #[test]
    fn test_tenant_slug_invalid_length() {
        assert_eq!(TenantSlug::new("ab".to_string()), Err(TenantSlugError::InvalidLength));
        assert_eq!(TenantSlug::new("a".repeat(64)), Err(TenantSlugError::InvalidLength));
    }

    #[test]
    fn test_tenant_slug_invalid_characters() {
        assert_eq!(TenantSlug::new("abC".to_string()), Err(TenantSlugError::InvalidCharacters));
        assert_eq!(TenantSlug::new("ab_c".to_string()), Err(TenantSlugError::InvalidCharacters));
        assert_eq!(TenantSlug::new("ab.c".to_string()), Err(TenantSlugError::InvalidCharacters));
        assert_eq!(TenantSlug::new("ab c".to_string()), Err(TenantSlugError::InvalidCharacters));
    }

    #[test]
    fn test_tenant_slug_leading_trailing_hyphen() {
        assert_eq!(TenantSlug::new("-abc".to_string()), Err(TenantSlugError::LeadingOrTrailingHyphen));
        assert_eq!(TenantSlug::new("abc-".to_string()), Err(TenantSlugError::LeadingOrTrailingHyphen));
        assert_eq!(TenantSlug::new("-abc-".to_string()), Err(TenantSlugError::LeadingOrTrailingHyphen));
    }

    #[test]
    fn test_extract_slug_valid() {
        assert_eq!(SubdomainTenant::extract_slug("tenant1.example.com"), Some("tenant1".to_string()));
        assert_eq!(SubdomainTenant::extract_slug("tenant1.example.com:8080"), Some("tenant1".to_string()));
        assert_eq!(SubdomainTenant::extract_slug("TENANT1.EXAMPLE.COM"), Some("tenant1".to_string()));
        assert_eq!(SubdomainTenant::extract_slug("my-tenant.co.uk"), Some("my-tenant".to_string()));
    }

    #[test]
    fn test_extract_slug_invalid() {
        assert_eq!(SubdomainTenant::extract_slug("localhost"), None);
        assert_eq!(SubdomainTenant::extract_slug("localhost:3000"), None);
        assert_eq!(SubdomainTenant::extract_slug("127.0.0.1"), None);
        assert_eq!(SubdomainTenant::extract_slug("127.0.0.1:8080"), None);
        assert_eq!(SubdomainTenant::extract_slug("[::1]"), None);
        assert_eq!(SubdomainTenant::extract_slug("[::1]:8080"), None);
        assert_eq!(SubdomainTenant::extract_slug("example"), None);
    }
}
