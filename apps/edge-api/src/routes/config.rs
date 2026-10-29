use worker::{Response, Router};
use crate::context::TenantContext;
use crate::config::BusinessConfig;

pub fn register(router: Router<'static, Option<TenantContext>>) -> Router<'static, Option<TenantContext>> {
    router.get("/api/v1/config", |_req, ctx| {
        let config = BusinessConfig::from_env(&ctx.env);
        Response::from_json(&config)
    })
}
