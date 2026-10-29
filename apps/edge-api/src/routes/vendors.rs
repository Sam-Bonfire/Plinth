use core_domain::{
    ids::VendorId,
    models::vendor::Vendor,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};
use std::str::FromStr;

#[derive(Debug, Deserialize, specta::Type)]
pub struct CreateVendorRequest {
    pub name: String,
    pub contact: String,
    #[specta(type = String)]
    pub rate: Decimal,
}

#[derive(Debug, Deserialize, specta::Type)]
pub struct UpdateVendorRequest {
    pub name: Option<String>,
    pub contact: Option<String>,
    #[specta(type = Option<String>)]
    pub rate: Option<Decimal>,
    pub active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbVendor {
    pub id: String,
    pub name: String,
    pub contact: String,
    pub rate: String,
    pub active: i64,
}

pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/vendors", list_vendors)
        .post_async("/api/v1/vendors", create_vendor)
        .patch_async("/api/v1/vendors/:id", update_vendor)
}

/// # Errors
/// Returns an error if the authorization fails or the database query fails.
pub async fn list_vendors<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let statement = db
        .prepare("SELECT id, name, contact, rate, active FROM vendors WHERE tenant_id = ?1 AND location_id = ?2")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
        ])?;

    let result: worker::d1::D1Result = statement.all().await?;
    let rows: Vec<DbVendor> = result.results()?;

    let mut vendors = Vec::new();
    for row in rows {
        let id_uuid = uuid::Uuid::from_str(&row.id).map_err(|_| worker::Error::RustError("Invalid UUID".into()))?;
        vendors.push(Vendor {
            id: VendorId::from(id_uuid),
            tenant_id: tenant_ctx.tenant_id,
            location_id: tenant_ctx.location_id,
            name: row.name,
            contact: row.contact,
            rate: Decimal::from_str(&row.rate).unwrap_or(Decimal::ZERO),
            active: row.active != 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        });
    }

    Response::from_json(&vendors)
}

/// # Errors
/// Returns an error if the authorization fails, the payload is invalid, or the database insertion fails.
pub async fn create_vendor<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Ok(create_req) = req.json::<CreateVendorRequest>().await else {
        return crate::router::json_error("Bad Request", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let id = VendorId::new();
    let now = chrono::Utc::now().to_rfc3339();

    let db = ctx.env.d1("CELLAR_DB")?;
    let statement = db
        .prepare(
            "INSERT INTO vendors (id, tenant_id, location_id, name, contact, rate, active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&create_req.name),
            worker::wasm_bindgen::JsValue::from_str(&create_req.contact),
            worker::wasm_bindgen::JsValue::from_str(&create_req.rate.to_string()),
            worker::wasm_bindgen::JsValue::from_f64(1.0),
            worker::wasm_bindgen::JsValue::from_str(&now),
            worker::wasm_bindgen::JsValue::from_str(&now),
        ])?;

    statement.run().await?;

    let vendor = Vendor {
        id,
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        name: create_req.name,
        contact: create_req.contact,
        rate: create_req.rate,
        active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Response::from_json(&vendor)
}

/// # Errors
/// Returns an error if the authorization fails, the payload is invalid, the vendor is not found, or the database update fails.
pub async fn update_vendor<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let id_param = ctx.param("id").ok_or_else(|| worker::Error::RustError("Missing ID".into()))?;

    let Ok(update_req) = req.json::<UpdateVendorRequest>().await else {
        return crate::router::json_error("Bad Request", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let now = chrono::Utc::now().to_rfc3339();

    let mut query = String::from("UPDATE vendors SET updated_at = ?");
    let mut args: Vec<worker::wasm_bindgen::JsValue> = vec![worker::wasm_bindgen::JsValue::from_str(&now)];

    if let Some(name) = &update_req.name {
        query.push_str(", name = ?");
        args.push(worker::wasm_bindgen::JsValue::from_str(name));
    }
    if let Some(contact) = &update_req.contact {
        query.push_str(", contact = ?");
        args.push(worker::wasm_bindgen::JsValue::from_str(contact));
    }
    if let Some(rate) = &update_req.rate {
        query.push_str(", rate = ?");
        args.push(worker::wasm_bindgen::JsValue::from_str(&rate.to_string()));
    }
    if let Some(active) = update_req.active {
        query.push_str(", active = ?");
        args.push(worker::wasm_bindgen::JsValue::from_f64(if active { 1.0 } else { 0.0 }));
    }

    query.push_str(" WHERE id = ? AND tenant_id = ? AND location_id = ?");
    args.push(worker::wasm_bindgen::JsValue::from_str(id_param));
    args.push(worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()));
    args.push(worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()));

    let statement = db.prepare(&query).bind(&args)?;
    statement.run().await?;

    let sel_statement = db
        .prepare("SELECT id, name, contact, rate, active FROM vendors WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(id_param),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
        ])?;

    let result: worker::d1::D1Result = sel_statement.all().await?;
    let mut rows: Vec<DbVendor> = result.results()?;

    if rows.is_empty() {
        return crate::router::json_error("Not Found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }

    let row = rows.remove(0);
    let id_uuid = uuid::Uuid::from_str(&row.id).map_err(|_| worker::Error::RustError("Invalid UUID".into()))?;

    let vendor = Vendor {
        id: VendorId::from(id_uuid),
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        name: row.name,
        contact: row.contact,
        rate: Decimal::from_str(&row.rate).unwrap_or(Decimal::ZERO),
        active: row.active != 0,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Response::from_json(&vendor)
}
