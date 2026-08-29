#![deny(unsafe_code)]

use edge_api::context::TenantContext;
use edge_api::router::{build_router, ApiErrorResponse, HealthResponse};

#[test]
fn test_api_error_response_structure() {
    let err_resp = ApiErrorResponse {
        error: "Invalid order total".to_string(),
        code: "VALIDATION_FAILED".to_string(),
        request_id: "req-test-99".to_string(),
    };
    assert_eq!(err_resp.error, "Invalid order total");
    assert_eq!(err_resp.code, "VALIDATION_FAILED");
    assert_eq!(err_resp.request_id, "req-test-99");
}

#[test]
fn test_router_builder_initialization() {
    use core_domain::enums::staff::Permissions;
    use core_domain::ids::{LocationId, StaffMemberId, TenantId};

    // Unauthenticated router
    let _unauth_router = build_router(None);

    // Authenticated router with Tenant Context
    let auth_context = TenantContext {
        tenant_id: TenantId::new(),
        location_id: LocationId::new(),
        staff_id: StaffMemberId::new(),
        permissions: Permissions::all(),
    };
    let _auth_router = build_router(Some(auth_context));
}

#[test]
fn test_api_error_response_serialization() {
    let err_resp = ApiErrorResponse {
        error: "Missing required header x-tenant-id".to_string(),
        code: "UNAUTHORIZED".to_string(),
        request_id: "req-err-401".to_string(),
    };

    let serialized = serde_json::to_string(&err_resp).unwrap();
    assert!(serialized.contains("Missing required header"));
    assert!(serialized.contains("UNAUTHORIZED"));
    assert!(serialized.contains("req-err-401"));
}

#[test]
fn test_health_response_serialization() {
    let health = HealthResponse {
        status: "ok".to_string(),
        timestamp: 1_724_850_000,
        version: "0.1.0".to_string(),
    };

    let serialized = serde_json::to_string(&health).unwrap();
    assert!(serialized.contains("\"status\":\"ok\""));
    assert!(serialized.contains("\"version\":\"0.1.0\""));
}



