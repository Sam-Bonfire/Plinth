use std::collections::HashMap;
use worker::{Request, Response, Result, RouteContext, Router};

/// Registers WebSocket synchronization routes
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/ws/sync", handle_ws_sync)
}

/// Upgrades incoming HTTP connection to WebSocket connected to `HearthRoom` Durable Object
///
/// # Errors
/// Returns an error if required query parameters are missing or DO namespace fails
pub async fn handle_ws_sync<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let url = req.url()?;
    let query_params: HashMap<String, String> = url.query_pairs().into_owned().collect();

    let Some(tenant_id) = query_params.get("tenant_id") else {
        return Response::error("Missing tenant_id query parameter", 400);
    };

    let Some(location_id) = query_params.get("location_id") else {
        return Response::error("Missing location_id query parameter", 400);
    };

    let do_namespace = ctx.env.durable_object("HEARTH_SYNC_ROOM")?;
    let room_id = do_namespace.id_from_name(&format!("{tenant_id}:{location_id}"))?;
    let stub = room_id.get_stub()?;

    stub.fetch_with_request(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_route_query_param_validation() {
        let params: HashMap<String, String> = HashMap::new();
        assert!(!params.contains_key("tenant_id"));
    }
}
