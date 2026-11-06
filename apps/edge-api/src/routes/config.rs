use crate::config::BusinessConfig;
use crate::context::TenantContext;
use core_domain::enums::staff::Permissions;
use worker::{Response, Router};

pub fn register(router: Router<'static, Option<TenantContext>>) -> Router<'static, Option<TenantContext>> {
    router.get("/api/v1/config", |req, ctx| {
        if let Err(rejection) = crate::auth::authorize(&req, &ctx, Permissions::empty()) {
            return Ok(rejection);
        }
        Response::from_json(&BusinessConfig::from_env(&ctx.env))
    })
}
