use core_domain::value_objects::tenant::SubdomainTenant;

#[must_use]
pub fn resolve_tenant(host: &str, rows: &[(String, String)]) -> Option<String> {
    let slug = SubdomainTenant::extract_slug(host)?;

    // Find matching slug (slug in DB might be lowercased, but extract_slug lowercases it anyway)
    // We just do a case-insensitive check to be robust.
    for (row_slug, tenant_id) in rows {
        if row_slug.eq_ignore_ascii_case(&slug) {
            return Some(tenant_id.clone());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_tenant_valid() {
        let rows = vec![
            ("tenant1".to_string(), "id1".to_string()),
            ("my-tenant".to_string(), "id2".to_string()),
        ];

        assert_eq!(resolve_tenant("tenant1.example.com", &rows), Some("id1".to_string()));
        assert_eq!(resolve_tenant("tenant1.example.com:8080", &rows), Some("id1".to_string()));
        assert_eq!(resolve_tenant("TENANT1.example.com", &rows), Some("id1".to_string()));
        assert_eq!(resolve_tenant("my-tenant.co.uk", &rows), Some("id2".to_string()));
    }

    #[test]
    fn test_resolve_tenant_unknown_slug() {
        let rows = vec![
            ("tenant1".to_string(), "id1".to_string()),
        ];

        assert_eq!(resolve_tenant("tenant2.example.com", &rows), None);
    }

    #[test]
    fn test_resolve_tenant_invalid_host() {
        let rows = vec![
            ("localhost".to_string(), "id1".to_string()),
            ("127".to_string(), "id2".to_string()),
        ];

        assert_eq!(resolve_tenant("localhost", &rows), None);
        assert_eq!(resolve_tenant("127.0.0.1", &rows), None);
    }
}
