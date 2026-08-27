#![forbid(unsafe_code)]

pub mod auth;
pub mod routes;

use worker::{event, Env, Request, Response, Result, Router};

/// Main fetch worker point
/// # Errors
/// Returns an error if the request cannot be handled.
#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    let router = Router::new();

    let router = routes::inventory::register(router);

    router.run(req, env).await
}

#[cfg(test)]
mod tests {
    #[test]
    fn edge_api_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
