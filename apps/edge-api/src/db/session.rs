use worker::d1::D1Database;
use worker::Result;

/// Provides context about the current tenant to ensure that all database queries are isolated.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TenantContext {
    pub tenant_id: String,
    pub location_id: String,
}

/// A wrapper around a D1 Database that enforces tenant and location isolation for queries.
/// It automatically injects the tenant and location parameters into queries.
pub struct TenantDbSession<'a> {
    db: &'a D1Database,
    ctx: &'a TenantContext,
}

impl<'a> TenantDbSession<'a> {
    /// Creates a new `TenantDbSession` with the provided database and tenant context.
    #[must_use]
    pub fn new(db: &'a D1Database, ctx: &'a TenantContext) -> Self {
        Self { db, ctx }
    }

    /// Prepares a query and automatically binds `tenant_id` and `location_id` as the
    /// FIRST two parameters of the query.
    ///
    /// The query MUST be written such that `tenant_id` is the first parameter (`?1`)
    /// and `location_id` is the second parameter (`?2`), or they are positioned
    /// correctly if using unnamed parameters (e.g., `WHERE tenant_id = ? AND location_id = ? ...`).
    ///
    /// # Errors
    /// Returns a `worker::Error` if the database preparation fails.
    pub fn prepare_scoped(&self, query: &str) -> Result<worker::d1::D1PreparedStatement> {
        self.db.prepare(query)
            .bind(&[self.ctx.tenant_id.clone().into(), self.ctx.location_id.clone().into()])
    }

    /// Constructs the complete bound arguments for a query.
    /// This automatically appends the `tenant_id` and `location_id` to the end
    /// of the provided user arguments.
    /// The query MUST be written to expect user arguments first, followed by
    /// `tenant_id` and `location_id`.
    #[must_use]
    pub fn build_scoped_args<'b>(&'b self, mut user_args: Vec<worker::d1::D1Type<'b>>) -> Vec<worker::d1::D1Type<'b>> {
        user_args.push(worker::d1::D1Type::Text(&self.ctx.tenant_id));
        user_args.push(worker::d1::D1Type::Text(&self.ctx.location_id));
        user_args
    }

    /// Prepares a query and binds user arguments, automatically appending `tenant_id` and `location_id`.
    /// The query MUST be written to expect `tenant_id` and `location_id` at the END
    /// of the parameter list.
    ///
    /// # Errors
    /// Returns a `worker::Error` if the database preparation fails.
    pub fn prepare_with_args<'b>(&'b self, query: &str, user_args: Vec<worker::d1::D1Type<'b>>) -> Result<worker::d1::D1PreparedStatement> {
        let args_d1 = self.build_scoped_args(user_args);
        let args: Vec<worker::wasm_bindgen::JsValue> = args_d1.iter().map(Into::into).collect();
        self.db.prepare(query).bind(&args)
    }

    /// Returns the underlying tenant context.
    #[must_use]
    pub fn context(&self) -> &TenantContext {
        self.ctx
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_scoped_args() {
        let ctx = TenantContext {
            tenant_id: "tenant-123".to_string(),
            location_id: "loc-456".to_string(),
        };

        let mut user_args = vec![worker::d1::D1Type::Text("order_id_1")];
        user_args.push(worker::d1::D1Type::Text(&ctx.tenant_id));
        user_args.push(worker::d1::D1Type::Text(&ctx.location_id));

        assert_eq!(user_args.len(), 3);
        assert!(matches!(user_args[1], worker::d1::D1Type::Text(s) if s == "tenant-123"));
        assert!(matches!(user_args[2], worker::d1::D1Type::Text(s) if s == "loc-456"));
    }
}
