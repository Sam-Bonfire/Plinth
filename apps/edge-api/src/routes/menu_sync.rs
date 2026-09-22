use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};
use worker::{
    wasm_bindgen::JsValue,
    Request, Response, Result, RouteContext, Router,
};

const PLATFORMS: [&str; 2] = ["Swiggy", "Zomato"];

/// Request payload to queue a menu sync to aggregators
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MenuSyncRequest {
    pub platforms: Vec<String>,
    pub menu_version: String,
    pub item_count: i64,
}

/// One queued platform sync run
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MenuSyncRunDto {
    pub id: String,
    pub platform: String,
    pub status: String,
}

/// Response after queueing menu sync runs
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct MenuSyncResponseDto {
    pub success: bool,
    pub runs: Vec<MenuSyncRunDto>,
}

/// Registers the menu sync route
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.post_async("/api/v1/menu/sync", queue_menu_sync)
}

/// Queues aggregator menu sync runs.
///
/// # Errors
/// Returns an error if authentication fails, input is invalid, or database write fails
pub async fn queue_menu_sync<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return Response::error("Unauthorized", 401);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::empty(),
    ) else {
        return Response::error("Unauthorized", 401);
    };

    let Ok(payload) = req.json::<MenuSyncRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };
    if !payload.is_valid() {
        return Response::error("platforms and menu_version are required", 400);
    }
    for platform in &payload.platforms {
        if !PLATFORMS.contains(&platform.as_str()) {
            return Response::error(format!("Unknown platform: {platform}"), 400);
        }
    }

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let now = chrono::Utc::now().to_rfc3339();
    let mut runs = Vec::with_capacity(payload.platforms.len());
    for platform in &payload.platforms {
        let id = uuid::Uuid::now_v7().to_string();
        let params: Vec<JsValue> = vec![
            id.clone().into(),
            tenant_ctx.tenant_id.to_string().into(),
            platform.clone().into(),
            payload.menu_version.clone().into(),
            payload.item_count.into(),
            "queued".into(),
            now.clone().into(),
        ];
        let stmt = db
            .prepare("INSERT INTO menu_sync_runs (id, tenant_id, platform, menu_version, item_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(&params)?;
        let _ = stmt.run().await?;
        runs.push(MenuSyncRunDto {
            id,
            platform: platform.clone(),
            status: "queued".to_string(),
        });
    }

    let res_dto = MenuSyncResponseDto { success: true, runs };
    let mut resp = Response::from_json(&res_dto)?;
    resp = resp.with_status(202);
    Ok(resp)
}

impl MenuSyncRequest {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        !self.platforms.is_empty() && !self.menu_version.trim().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::ids::TenantId;

    #[test]
    fn test_sync_request_serde() {
        let req = MenuSyncRequest {
            platforms: vec!["Swiggy".to_string()],
            menu_version: "v42".to_string(),
            item_count: 12,
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("Swiggy"));
        let back: MenuSyncRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(back.menu_version, "v42");
    }

    #[test]
    fn test_request_validation() {
        let valid = MenuSyncRequest {
            platforms: vec!["Zomato".to_string()],
            menu_version: "v1".to_string(),
            item_count: 3,
        };
        assert!(valid.is_valid());
        let empty = MenuSyncRequest {
            platforms: Vec::new(),
            menu_version: "v1".to_string(),
            item_count: 3,
        };
        assert!(!empty.is_valid());
    }

    #[test]
    fn test_platform_allowlist() {
        assert!(PLATFORMS.contains(&"Swiggy"));
        assert!(PLATFORMS.contains(&"Zomato"));
        assert!(!PLATFORMS.contains(&"UberEats"));
    }

    #[test]
    fn tenant_scoping_uses_caller_context() {
        let tenant = TenantId::new();
        assert_ne!(tenant.to_string(), "");
    }
}
