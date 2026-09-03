use core_domain::enums::staff::{Permissions, StaffRole};
use core_domain::ids::{LocationId, StaffMemberId, TenantId};
use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};

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
        .get_async("/api/v1/staff/:id", get_staff)
        .patch_async("/api/v1/staff/:id", update_staff)
        .post_async("/api/v1/staff/:id/pin-verify", verify_pin)
}

pub async fn create_staff<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", Permissions::MANAGE_STAFF) else {
        return Response::error("Unauthorized", 401);
    };

    let payload: CreateStaffRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return Response::error(format!("Invalid JSON payload: {e}"), 400),
    };

    if payload.name.trim().is_empty() {
        return Response::error("Staff name cannot be empty", 400);
    }
    if payload.pin.len() < 4 || payload.pin.len() > 6 {
        return Response::error("PIN must be 4-6 digits", 400);
    }

    let staff_id = StaffMemberId::new();
    let permissions = payload.role.default_permissions().bits();
    let now = chrono::Utc::now().to_rfc3339();

    // Persist to D1 if available; fall back to mock on missing binding in tests
    if let Ok(db) = ctx.env.d1("CELLAR_DB") {
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
                payload.pin.clone().into(),
                1.into(),
                now.clone().into(),
                now.clone().into(),
            ])?;
        if let Err(e) = stmt.run().await {
            return Response::error(format!("Database error: {e:?}"), 500);
        }
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

pub async fn list_staff<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", Permissions::empty()) else {
        return Response::error("Unauthorized", 401);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(_) => {
            let resp = ListStaffResponse { data: vec![], total: 0 };
            return Response::from_json(&resp);
        }
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

pub async fn get_staff<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", Permissions::empty()) else {
        return Response::error("Unauthorized", 401);
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
        return Response::error("Staff not found", 404);
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

pub async fn update_staff<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", Permissions::MANAGE_STAFF) else {
        return Response::error("Unauthorized", 401);
    };

    let staff_id_str = ctx.param("id").map_or("", |v| v).to_string();
    let payload: UpdateStaffRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return Response::error(format!("Invalid JSON payload: {e}"), 400),
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

pub async fn verify_pin<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", Permissions::empty()) else {
        return Response::error("Unauthorized", 401);
    };

    let staff_id_str = ctx.param("id").map_or("", |v| v).to_string();
    let payload: PinVerifyRequest = match req.json().await {
        Ok(p) => p,
        Err(e) => return Response::error(format!("Invalid JSON payload: {e}"), 400),
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let stmt = db
        .prepare("SELECT pin_hash FROM staff_members WHERE id = ?1 AND tenant_id = ?2")
        .bind(&[staff_id_str.clone().into(), tenant_ctx.tenant_id.to_string().into()])?;
    let result = stmt.first::<serde_json::Value>(None).await?;
    let Some(row) = result else {
        return Response::error("Staff not found", 404);
    };
    let pin_hash = row.get("pin_hash").and_then(|v| v.as_str()).unwrap_or("");
    let valid = pin_hash == payload.pin;

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
}
