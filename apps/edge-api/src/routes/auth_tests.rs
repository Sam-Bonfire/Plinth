#[cfg(test)]
mod tests {
    use crate::auth::{JwtClaims, verify_context_from_headers};
    use core_domain::enums::staff::Permissions;

    fn get_now() -> usize {
        usize::try_from(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()).unwrap()
    }

    fn test_token(role: &str, perms: u32, token_type: &str) -> String {
        let claims = JwtClaims {
            sub: uuid::Uuid::now_v7().to_string(),
            iss: "plinth-auth".to_string(),
            exp: get_now() + 3600,
            tenant_id: "00000000-0000-0000-0000-000000000001".to_string(),
            location_id: "00000000-0000-0000-0000-000000000002".to_string(),
            roles: vec![role.to_string()],
            permissions: perms,
            token_type: token_type.to_string(),
        };
        let header = jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256);
        jsonwebtoken::encode(&header, &claims, &jsonwebtoken::EncodingKey::from_secret(b"secret")).unwrap()
    }

    #[test]
    fn rejects_customer_token_for_staff_routes() {
        let token = test_token("Customer", 0, "customer");
        let result = verify_context_from_headers(
            Some("00000000-0000-0000-0000-000000000001".to_string()),
            Some("00000000-0000-0000-0000-000000000002".to_string()),
            Some(&format!("Bearer {token}")),
            "secret",
            Permissions::empty(), // Should fail even if permissions empty
        );
        assert_eq!(result.unwrap_err(), "Invalid token type");
    }

    #[test]
    fn rejects_staff_missing_permissions() {
        // Staff missing PROCESS_REFUND
        let token = test_token("Waiter", Permissions::TAKE_ORDER.bits(), "staff");
        let result = verify_context_from_headers(
            Some("00000000-0000-0000-0000-000000000001".to_string()),
            Some("00000000-0000-0000-0000-000000000002".to_string()),
            Some(&format!("Bearer {token}")),
            "secret",
            Permissions::PROCESS_REFUND,
        );
        assert_eq!(result.unwrap_err(), "Insufficient permissions");

        // Staff missing MANAGE_MESS
        let result_mess = verify_context_from_headers(
            Some("00000000-0000-0000-0000-000000000001".to_string()),
            Some("00000000-0000-0000-0000-000000000002".to_string()),
            Some(&format!("Bearer {token}")),
            "secret",
            Permissions::MANAGE_MESS,
        );
        assert_eq!(result_mess.unwrap_err(), "Insufficient permissions");

        // Staff missing MANAGE_INVENTORY
        let result_inv = verify_context_from_headers(
            Some("00000000-0000-0000-0000-000000000001".to_string()),
            Some("00000000-0000-0000-0000-000000000002".to_string()),
            Some(&format!("Bearer {token}")),
            "secret",
            Permissions::MANAGE_INVENTORY,
        );
        assert_eq!(result_inv.unwrap_err(), "Insufficient permissions");
    }

    #[test]
    fn allows_staff_with_correct_permissions() {
        let token = test_token("Manager", Permissions::PROCESS_REFUND.bits() | Permissions::MANAGE_MESS.bits() | Permissions::MANAGE_INVENTORY.bits(), "staff");
        let result = verify_context_from_headers(
            Some("00000000-0000-0000-0000-000000000001".to_string()),
            Some("00000000-0000-0000-0000-000000000002".to_string()),
            Some(&format!("Bearer {token}")),
            "secret",
            Permissions::PROCESS_REFUND,
        );
        assert!(result.is_ok());
    }
}
