use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LocationDto {
    pub id: String,
    pub name: String,
}

pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/api/v1/locations", get_locations)
}

/// Retrieves locations for the current tenant.
///
/// # Errors
/// Returns an error if authentication fails or query execution fails
pub async fn get_locations<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, Permissions::empty()) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let stmt = db
        .prepare("SELECT DISTINCT location_id FROM floor_plans WHERE tenant_id = ?1")
        .bind(&[tenant_ctx.tenant_id.to_string().into()]);

    let stmt = match stmt {
        Ok(stmt) => stmt,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let result = match stmt.all().await {
        Ok(result) => result,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let rows: Vec<serde_json::Value> = match result.results() {
        Ok(rows) => rows,
        Err(e) => return crate::router::internal_error(&req, format!("Database error: {e}")),
    };

    let mut locations = Vec::new();
    for row in rows {
        if let Some(location_id) = row.get("location_id").and_then(|v| v.as_str()) {
            locations.push(LocationDto {
                id: location_id.to_string(),
                name: format!("Location {location_id}"),
            });
        }
    }

    Response::from_json(&locations)
}
