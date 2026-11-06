use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use core_domain::enums::staff::{Permissions, StaffRole};
use core_domain::ids::{LocationId, StaffMemberId, TenantId};
use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};
use std::collections::HashMap;

fn hash_pin(pin: &str) -> std::result::Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn verify_pin_hash(hash: &str, pin: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok()
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct CreateStaffRequest {
    pub name: String,
    pub role: StaffRole,
    pub pin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct UpdateStaffRequest {
    pub name: Option<String>,
    pub role: Option<StaffRole>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct StaffResponseDto {
    pub id: StaffMemberId,
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub name: String,
    pub role: StaffRole,
    pub permissions: u32,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PinVerifyRequest {
    pub pin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PinVerifyResponse {
    pub valid: bool,
    pub staff_id: StaffMemberId,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ListStaffResponse {
    pub data: Vec<StaffResponseDto>,
    pub total: usize,
}

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .post_async("/api/v1/staff", create_staff)
        .get_async("/api/v1/staff", list_staff)
        .get_async("/api/v1/staff/permissions", get_staff_permissions)
        .get_async("/api/v1/staff/attendance", list_attendance)
        .post_async("/api/v1/staff/attendance", record_attendance)
        .get_async("/api/v1/staff/:id", get_staff)
        .patch_async("/api/v1/staff/:id", update_staff)
        .post_async("/api/v1/staff/:id/pin-verify", verify_pin)
}

/// Creates a new staff member
///
/// # Errors
/// Returns error if auth fails, payload invalid or DB fails
#[allow(clippy::missing_errors_doc)]
pub async fn create_staff<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::MANAGE_STAFF) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let payload: CreateStaffRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    if payload.name.trim().is_empty() {
        return crate::router::json_error("Staff name cannot be empty", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }
    if payload.pin.len() < 4 || payload.pin.len() > 6 {
        return crate::router::json_error("PIN must be 4-6 digits", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }

    let staff_id = StaffMemberId::new();
    let permissions = payload.role.default_permissions().bits();
    let now = chrono::Utc::now().to_rfc3339();
    let pin_hash = match hash_pin(&payload.pin) {
        Ok(h) => h,
        Err(e) => return crate::router::internal_error(&req, format!("Failed to hash PIN: {e}")),
    };

    // Persist to D1. A missing binding must fail the request: answering 201
    // without storing the staff member silently breaks later PIN logins.
    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, format!("Database unavailable: {e}")),
    };
    let stmt = db
        .prepare(
            "INSERT INTO staff_members (id, tenant_id, location_id, name, role, permissions, pin_hash, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        )
        .bind(&[
            staff_id.to_string().into(),
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
            payload.name.clone().into(),
            format!("{:?}", payload.role).into(),
            f64::from(permissions).into(),
            pin_hash.into(),
            1.into(),
            now.clone().into(),
            now.clone().into(),
        ])?;
    if let Err(e) = stmt.run().await {
        return crate::router::json_error(format!("Database error: {e:?}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500);
    }

    let resp = StaffResponseDto {
        id: staff_id,
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        name: payload.name,
        role: payload.role,
        permissions,
        is_active: true,
        created_at: now,
    };

    Response::from_json(&resp).map(|r| r.with_status(201))
}

/// Lists staff for tenant/location
///
/// # Errors
/// Returns error if auth fails or DB fails
#[allow(clippy::missing_errors_doc, clippy::manual_let_else, clippy::single_match_else, clippy::redundant_closure_for_method_calls, clippy::unnecessary_map_or)]
pub async fn list_staff<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Ok(db) = ctx.env.d1("CELLAR_DB") else {
        let resp = ListStaffResponse { data: vec![], total: 0 };
        return Response::from_json(&resp);
    };

    let stmt = db
        .prepare("SELECT id, tenant_id, location_id, name, role, permissions, is_active, created_at FROM staff_members WHERE tenant_id = ?1 AND location_id = ?2 AND deleted_at IS NULL")
        .bind(&[
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
        ])?;

    let result = stmt.all().await?;
    let rows: Vec<serde_json::Value> = result.results()?;
    let mut data = Vec::new();
    for row in rows {
        if let (Some(id_str), Some(name), Some(role_str), Some(perms)) = (
            row.get("id").and_then(|v| v.as_str()),
            row.get("name").and_then(|v| v.as_str()),
            row.get("role").and_then(|v| v.as_str()),
            row.get("permissions").and_then(|v| v.as_u64()),
        ) {
            let dto = StaffResponseDto {
                id: StaffMemberId::from(uuid::Uuid::parse_str(id_str).unwrap_or_else(|_| uuid::Uuid::now_v7())),
                tenant_id: tenant_ctx.tenant_id,
                location_id: tenant_ctx.location_id,
                name: name.to_string(),
                role: parse_role(role_str),
                permissions: u32::try_from(perms).unwrap_or(0),
                is_active: row.get("is_active").and_then(|v| v.as_u64()).map_or(true, |v| v != 0),
                created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };
            data.push(dto);
        }
    }

    let total = data.len();
    let resp = ListStaffResponse { data, total };
    Response::from_json(&resp)
}

/// Gets a single staff member
///
/// # Errors
/// Returns error if auth fails, staff not found or DB fails
#[allow(clippy::missing_errors_doc, clippy::redundant_closure_for_method_calls, clippy::unnecessary_map_or)]
pub async fn get_staff<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let staff_id_str = ctx.param("id").map_or("", |v| v);
    let db = ctx.env.d1("CELLAR_DB")?;

    let stmt = db
        .prepare("SELECT id, tenant_id, location_id, name, role, permissions, is_active, created_at FROM staff_members WHERE id = ?1 AND tenant_id = ?2 AND deleted_at IS NULL")
        .bind(&[
            staff_id_str.into(),
            tenant_ctx.tenant_id.to_string().into(),
        ])?;
    let result = stmt.first::<serde_json::Value>(None).await?;
    let Some(row) = result else {
        return crate::router::json_error("Staff not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    };

    let dto = StaffResponseDto {
        id: StaffMemberId::from(uuid::Uuid::parse_str(staff_id_str).unwrap_or_else(|_| uuid::Uuid::now_v7())),
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        role: parse_role(row.get("role").and_then(|v| v.as_str()).unwrap_or("Waiter")),
        permissions: row.get("permissions").and_then(|v| v.as_u64()).map_or(0, |v| u32::try_from(v).unwrap_or(0)),
        is_active: row.get("is_active").and_then(|v| v.as_u64()).map_or(true, |v| v != 0),
        created_at: row.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    };

    Response::from_json(&dto)
}

/// Updates a staff member
///
/// # Errors
/// Returns error if auth fails, payload invalid or DB fails
#[allow(clippy::missing_errors_doc)]
pub async fn update_staff<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::MANAGE_STAFF) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let staff_id_str = ctx.param("id").map_or("", |v| v).to_string();
    let payload: UpdateStaffRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(name) = payload.name {
        let stmt = db
            .prepare("UPDATE staff_members SET name = ?1, updated_at = ?2 WHERE id = ?3 AND tenant_id = ?4")
            .bind(&[name.into(), now.clone().into(), staff_id_str.clone().into(), tenant_ctx.tenant_id.to_string().into()])?;
        stmt.run().await?;
    }
    if let Some(role) = payload.role {
        let perms = role.default_permissions().bits();
        let stmt = db
            .prepare("UPDATE staff_members SET role = ?1, permissions = ?2, updated_at = ?3 WHERE id = ?4 AND tenant_id = ?5")
            .bind(&[
                format!("{role:?}").into(),
                f64::from(perms).into(),
                now.clone().into(),
                staff_id_str.clone().into(),
                tenant_ctx.tenant_id.to_string().into(),
            ])?;
        stmt.run().await?;
    }

    get_staff(req, ctx).await
}

/// Verifies staff PIN
///
/// # Errors
/// Returns error if auth fails, payload invalid or DB fails
#[allow(clippy::missing_errors_doc)]
pub async fn verify_pin<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let staff_id_str = ctx.param("id").map_or("", |v| v).to_string();
    let payload: PinVerifyRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return crate::router::json_error(format!("Invalid JSON payload: {e}"), "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400),
    };

    let db = ctx.env.d1("CELLAR_DB")?;

    if let Ok(true) = crate::lockout::is_locked_out(&db, &tenant_ctx.tenant_id.to_string(), &staff_id_str).await {
        worker::console_error!("Lockout enforced for staff_id: {}", staff_id_str);
        let _ = crate::lockout::record_attempt(&db, &tenant_ctx.tenant_id.to_string(), &staff_id_str, false).await;
        return Response::from_json(&PinVerifyResponse {
            valid: false,
            staff_id: StaffMemberId::from(uuid::Uuid::parse_str(&staff_id_str).unwrap_or_else(|_| uuid::Uuid::now_v7())),
        });
    }

    let stmt = db
        .prepare("SELECT pin_hash FROM staff_members WHERE id = ?1 AND tenant_id = ?2")
        .bind(&[staff_id_str.clone().into(), tenant_ctx.tenant_id.to_string().into()])?;
    let result = stmt.first::<serde_json::Value>(None).await?;
    let Some(row) = result else {
        let _ = crate::lockout::record_attempt(&db, &tenant_ctx.tenant_id.to_string(), &staff_id_str, false).await;
        return crate::router::json_error("Staff not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    };
    let pin_hash = row.get("pin_hash").and_then(|v| v.as_str()).unwrap_or("");
    let valid = verify_pin_hash(pin_hash, &payload.pin);

    let _ = crate::lockout::record_attempt(&db, &tenant_ctx.tenant_id.to_string(), &staff_id_str, valid).await;

    let resp = PinVerifyResponse {
        valid,
        staff_id: StaffMemberId::from(uuid::Uuid::parse_str(&staff_id_str).unwrap_or_else(|_| uuid::Uuid::now_v7())),
    };

    Response::from_json(&resp)
}

fn parse_role(s: &str) -> StaffRole {
    match s {
        "Owner" => StaffRole::Owner,
        "Manager" => StaffRole::Manager,
        "Cashier" => StaffRole::Cashier,
        "Kitchen" => StaffRole::Kitchen,
        _ => StaffRole::Waiter,
    }
}

/// DTO for permissions
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PermissionsResponseDto {
    pub roles: HashMap<String, u32>,
}

/// DTO for an attendance entry
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AttendanceEntryDto {
    pub id: String,
    pub staff_id: StaffMemberId,
    pub name: String,
    pub clock_in: String,
    pub clock_out: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ActiveShift {
    id: String,
}

#[derive(Debug, Deserialize)]
struct DbAttendance {
    id: String,
    staff_id: String,
    name: String,
    clock_in: String,
    clock_out: Option<String>,
}

/// Request to record attendance (clock in or clock out)
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RecordAttendanceRequest {
    pub staff_id: StaffMemberId,
    pub action: String, // "CLOCK_IN" or "CLOCK_OUT"
}

/// Response for listing attendance
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ListAttendanceResponse {
    pub data: Vec<AttendanceEntryDto>,
}

/// Pure function to validate clock in
/// Returns true if valid (i.e. no active clock-in exists)
#[must_use]
pub fn validate_clock_in(has_active_shift: bool) -> bool {
    !has_active_shift
}

/// Pure function to validate clock out
/// Returns true if valid (i.e. an active clock-in exists)
#[must_use]
pub fn validate_clock_out(has_active_shift: bool) -> bool {
    has_active_shift
}

/// Staff may clock themselves; clocking anyone else needs staff management.
#[must_use]
pub fn may_record_for(caller: StaffMemberId, target: StaffMemberId, permissions: Permissions) -> bool {
    caller == target || permissions.contains(Permissions::MANAGE_STAFF)
}

/// Gets the permissions map derived from the domain
#[allow(clippy::missing_errors_doc)]
pub async fn get_staff_permissions<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let _tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::MANAGE_STAFF) {
        Ok(t) => t,
        Err(r) => return Ok(r),
    };

    let mut roles = HashMap::new();
    roles.insert("Owner".to_string(), StaffRole::Owner.default_permissions().bits());
    roles.insert("Manager".to_string(), StaffRole::Manager.default_permissions().bits());
    roles.insert("Cashier".to_string(), StaffRole::Cashier.default_permissions().bits());
    roles.insert("Waiter".to_string(), StaffRole::Waiter.default_permissions().bits());
    roles.insert("Kitchen".to_string(), StaffRole::Kitchen.default_permissions().bits());

    Response::from_json(&PermissionsResponseDto { roles })
}

/// Lists attendance entries
#[allow(clippy::missing_errors_doc, clippy::redundant_closure_for_method_calls, clippy::unnecessary_map_or)]
pub async fn list_attendance<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(t) => t,
        Err(r) => return Ok(r),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, e),
    };

    // Join with staff_members to get the name
    let stmt = db
        .prepare("SELECT a.id, a.staff_id, s.name, a.clock_in, a.clock_out FROM staff_attendance a JOIN staff_members s ON a.staff_id = s.id WHERE a.tenant_id = ?1 AND a.location_id = ?2 ORDER BY a.clock_in DESC LIMIT 100")
        .bind(&[
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
        ])?;

    let result = stmt.all().await?;
    let rows: Vec<DbAttendance> = result.results()?;
    let mut data = Vec::with_capacity(rows.len());

    for row in rows {
        let staff_uuid = uuid::Uuid::parse_str(&row.staff_id)
            .map_err(|_| worker::Error::RustError("Invalid staff UUID".into()))?;
        data.push(AttendanceEntryDto {
            id: row.id,
            staff_id: StaffMemberId::from(staff_uuid),
            name: row.name,
            clock_in: row.clock_in,
            clock_out: row.clock_out,
        });
    }

    Response::from_json(&ListAttendanceResponse { data })
}

/// Records a clock in or clock out
#[allow(clippy::missing_errors_doc, clippy::missing_panics_doc)]
pub async fn record_attendance<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(t) => t,
        Err(r) => return Ok(r),
    };

    let Ok(payload) = req.json::<RecordAttendanceRequest>().await else {
        return crate::router::json_error("Invalid JSON payload", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    if !may_record_for(tenant_ctx.staff_id, payload.staff_id, tenant_ctx.permissions) {
        return crate::router::json_error("Forbidden", "FORBIDDEN", &crate::router::get_request_id(&req), 403);
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, e),
    };

    let now = chrono::Utc::now().to_rfc3339();

    // Check if staff exists and belongs to tenant
    let stmt_check = db
        .prepare("SELECT id FROM staff_members WHERE id = ?1 AND tenant_id = ?2 AND deleted_at IS NULL")
        .bind(&[
            payload.staff_id.to_string().into(),
            tenant_ctx.tenant_id.to_string().into(),
        ])?;
    if stmt_check.first::<serde_json::Value>(None).await?.is_none() {
        return crate::router::json_error("Staff not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }

    // Check active shift
    let stmt_active = db
        .prepare("SELECT id FROM staff_attendance WHERE tenant_id = ?1 AND location_id = ?2 AND staff_id = ?3 AND clock_out IS NULL")
        .bind(&[
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
            payload.staff_id.to_string().into(),
        ])?;
    let active_shift = stmt_active.first::<ActiveShift>(None).await?;
    let has_active_shift = active_shift.is_some();

    if payload.action == "CLOCK_IN" {
        if !validate_clock_in(has_active_shift) {
             return crate::router::json_error("Already clocked in", "INVALID_STATE", &crate::router::get_request_id(&req), 400);
        }
        let id = uuid::Uuid::now_v7().to_string();
        let stmt = db
            .prepare("INSERT INTO staff_attendance (id, tenant_id, location_id, staff_id, clock_in, clock_out, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)")
            .bind(&[
                id.into(),
                tenant_ctx.tenant_id.to_string().into(),
                tenant_ctx.location_id.to_string().into(),
                payload.staff_id.to_string().into(),
                now.clone().into(),
                now.into(),
            ])?;
        if let Err(e) = stmt.run().await {
            return crate::router::internal_error(&req, e);
        }
    } else if payload.action == "CLOCK_OUT" {
         if !validate_clock_out(has_active_shift) {
             return crate::router::json_error("Not clocked in", "INVALID_STATE", &crate::router::get_request_id(&req), 400);
         }
         let Some(active) = active_shift else {
             return crate::router::json_error("Not clocked in", "INVALID_STATE", &crate::router::get_request_id(&req), 400);
         };
         let stmt = db
            .prepare("UPDATE staff_attendance SET clock_out = ?1 WHERE id = ?2 AND tenant_id = ?3 AND location_id = ?4")
            .bind(&[
                now.into(),
                active.id.into(),
                tenant_ctx.tenant_id.to_string().into(),
                tenant_ctx.location_id.to_string().into(),
            ])?;
         if let Err(e) = stmt.run().await {
            return crate::router::internal_error(&req, e);
        }
    } else {
         return crate::router::json_error("Invalid action", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    }

    Response::ok("OK")
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::enums::staff::StaffRole;

    #[test]
    fn test_create_staff_request_serde() {
        let req = CreateStaffRequest {
            name: "Asha".to_string(),
            role: StaffRole::Manager,
            pin: "1234".to_string(),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("Asha"));
        assert!(json.contains("Manager"));
    }

    #[test]
    fn test_parse_role() {
        assert_eq!(parse_role("Owner"), StaffRole::Owner);
        assert_eq!(parse_role("Unknown"), StaffRole::Waiter);
    }

    #[test]
    fn test_pin_hash_round_trip() {
        let hash = hash_pin("4321").expect("hash");
        assert!(hash.starts_with("$argon2"));
        assert!(verify_pin_hash(&hash, "4321"));
        assert!(!verify_pin_hash(&hash, "0000"));
    }

    #[test]
    fn test_pin_verify_rejects_garbage() {
        assert!(!verify_pin_hash("", "4321"));
        assert!(!verify_pin_hash("plaintext-legacy", "plaintext-legacy"));
    }

    #[test]
    fn test_validate_clock_in_success() {
        assert!(validate_clock_in(false));
    }

    #[test]
    fn test_validate_clock_in_rejects_double() {
        assert!(!validate_clock_in(true));
    }

    #[test]
    fn test_validate_clock_out_without_clock_in() {
        assert!(!validate_clock_out(false));
    }

    #[test]
    fn test_validate_clock_out_success() {
        assert!(validate_clock_out(true));
    }

    #[test]
    fn test_may_record_for_self_or_manager_only() {
        let caller = StaffMemberId::new();
        let other = StaffMemberId::new();
        assert!(may_record_for(caller, caller, Permissions::empty()));
        assert!(!may_record_for(caller, other, Permissions::empty()));
        assert!(may_record_for(caller, other, Permissions::MANAGE_STAFF));
    }
}
