use core_domain::{
    ids::{PurchaseOrderId, StockItemId, VendorId},
    models::purchase_order::{PoLineItem, PurchaseOrder, PurchaseOrderStatus},
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use worker::{Request, Response, Result, RouteContext, Router};

#[derive(Debug, Deserialize, specta::Type)]
pub struct CreatePoLineRequest {
    pub stock_item_id: StockItemId,
    #[specta(type = String)]
    pub quantity: Decimal,
    pub unit_cost_minor: i64,
}

#[derive(Debug, Deserialize, specta::Type)]
pub struct CreatePurchaseOrderRequest {
    pub vendor_id: Option<VendorId>,
    pub supplier_name: Option<String>,
    pub lines: Vec<CreatePoLineRequest>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DbPo {
    id: String,
    supplier_name: String,
    vendor_id: Option<String>,
    status: String,
    total_minor: i64,
    created_by: String,
    created_at: String,
    received_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LineQty {
    stock_item_id: String,
    quantity: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DbPoLine {
    id: String,
    po_id: String,
    stock_item_id: String,
    quantity: String,
    unit_cost_minor: i64,
    total_minor: i64,
}

pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/purchase-orders", list_pos)
        .post_async("/api/v1/purchase-orders", create_po)
        .post_async("/api/v1/purchase-orders/:id/receive", receive_po)
}

/// # Errors
/// Returns an error if authorization fails or database queries fail.
/// # Panics
/// Panics if UUIDs from the database cannot be parsed.
pub async fn list_pos<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let stmt = db
        .prepare("SELECT id, supplier_name, vendor_id, status, total_minor, created_by, created_at, received_at FROM purchase_orders WHERE tenant_id = ?1 AND location_id = ?2 ORDER BY created_at DESC")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
        ])?;

    let result: worker::d1::D1Result = stmt.all().await?;
    let rows: Vec<DbPo> = result.results()?;

    let mut pos = Vec::new();

    for row in rows {
        let po_id = PurchaseOrderId::from(uuid::Uuid::from_str(&row.id).unwrap());

        let lines_stmt = db.prepare("SELECT id, po_id, stock_item_id, quantity, unit_cost_minor, total_minor FROM po_line_items WHERE po_id = ?1").bind(&[worker::wasm_bindgen::JsValue::from_str(&row.id)])?;
        let lines_res: worker::d1::D1Result = lines_stmt.all().await?;
        let line_rows: Vec<DbPoLine> = lines_res.results()?;

        let mut lines = Vec::new();
        for l_row in line_rows {
            lines.push(PoLineItem {
                id: l_row.id,
                po_id,
                stock_item_id: StockItemId::from(uuid::Uuid::from_str(&l_row.stock_item_id).unwrap()),
                quantity: Decimal::from_str(&l_row.quantity).unwrap_or(Decimal::ZERO),
                unit_cost_minor: l_row.unit_cost_minor,
                total_minor: l_row.total_minor,
            });
        }

        pos.push(PurchaseOrder {
            id: po_id,
            tenant_id: tenant_ctx.tenant_id,
            location_id: tenant_ctx.location_id,
            supplier_name: row.supplier_name,
            vendor_id: row.vendor_id.map(|v| VendorId::from(uuid::Uuid::from_str(&v).unwrap())),
            status: match row.status.as_str() {
                "Submitted" => PurchaseOrderStatus::Submitted,
                "Received" => PurchaseOrderStatus::Received,
                "Cancelled" => PurchaseOrderStatus::Cancelled,
                _ => PurchaseOrderStatus::Draft,
            },
            total_minor: row.total_minor,
            created_by: row.created_by,
            lines,
            created_at: chrono::DateTime::parse_from_rfc3339(&row.created_at).unwrap().with_timezone(&chrono::Utc),
            received_at: row.received_at.map(|d| chrono::DateTime::parse_from_rfc3339(&d).unwrap().with_timezone(&chrono::Utc)),
        });
    }

    Response::from_json(&pos)
}

/// # Errors
/// Returns an error if authorization fails, the payload is invalid, or database insertions fail.
/// # Panics
/// Panics if a timestamp cannot be generated.
#[allow(clippy::cast_precision_loss)]
pub async fn create_po<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Ok(create_req) = req.json::<CreatePurchaseOrderRequest>().await else {
        return crate::router::json_error("Bad Request", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let id = PurchaseOrderId::new();
    let now = chrono::Utc::now().to_rfc3339();
    let db = ctx.env.d1("CELLAR_DB")?;

    let supplier_name = create_req.supplier_name.unwrap_or_else(|| "Unknown".to_string());

    let mut total_minor = 0;

    let vendor_id_val = match create_req.vendor_id {
        Some(v) => worker::wasm_bindgen::JsValue::from_str(&v.to_string()),
        None => worker::wasm_bindgen::JsValue::null(),
    };

    let stmt = db.prepare("INSERT INTO purchase_orders (id, tenant_id, location_id, supplier_name, vendor_id, status, total_minor, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&supplier_name),
            vendor_id_val,
            worker::wasm_bindgen::JsValue::from_str("Submitted"),
            worker::wasm_bindgen::JsValue::from_f64(0.0),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.staff_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&now),
        ])?;
    stmt.run().await?;

    let mut lines = Vec::new();

    for req_line in create_req.lines {
        let line_id = uuid::Uuid::now_v7().to_string();
        let Ok(line_total) = i64::try_from((Decimal::from(req_line.unit_cost_minor) * req_line.quantity).round()) else {
            return crate::router::json_error("Line total out of range", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
        };
        total_minor += line_total;

        let l_stmt = db.prepare("INSERT INTO po_line_items (id, po_id, stock_item_id, quantity, unit_cost_minor, total_minor) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
            .bind(&[
                worker::wasm_bindgen::JsValue::from_str(&line_id),
                worker::wasm_bindgen::JsValue::from_str(&id.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&req_line.stock_item_id.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&req_line.quantity.to_string()),
                worker::wasm_bindgen::JsValue::from_f64(req_line.unit_cost_minor as f64),
                worker::wasm_bindgen::JsValue::from_f64(line_total as f64),
            ])?;
        l_stmt.run().await?;

        lines.push(PoLineItem {
            id: line_id,
            po_id: id,
            stock_item_id: req_line.stock_item_id,
            quantity: req_line.quantity,
            unit_cost_minor: req_line.unit_cost_minor,
            total_minor: line_total,
        });
    }

    let update_total = db.prepare("UPDATE purchase_orders SET total_minor = ?1 WHERE id = ?2").bind(&[
        worker::wasm_bindgen::JsValue::from_f64(total_minor as f64),
        worker::wasm_bindgen::JsValue::from_str(&id.to_string()),
    ])?;
    update_total.run().await?;

    let po = PurchaseOrder {
        id,
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        supplier_name,
        vendor_id: create_req.vendor_id,
        status: PurchaseOrderStatus::Submitted,
        total_minor,
        created_by: tenant_ctx.staff_id.to_string(),
        lines,
        created_at: chrono::DateTime::parse_from_rfc3339(&now).unwrap().with_timezone(&chrono::Utc),
        received_at: None,
    };

    Response::from_json(&po)
}

/// # Errors
/// Returns an error if authorization fails, the PO is not found, or database updates fail.
/// # Panics
/// Panics if database results unexpectedly missing fields.
pub async fn receive_po<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let id_param = ctx.param("id").ok_or_else(|| worker::Error::RustError("Missing ID".into()))?;
    let db = ctx.env.d1("CELLAR_DB")?;

    let check_stmt = db.prepare("SELECT status FROM purchase_orders WHERE id = ?1 AND tenant_id = ?2")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(id_param),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string())
        ])?;

    let check_res: worker::d1::D1Result = check_stmt.all().await?;
    let rows: Vec<DbPo> = check_res.results()?;
    if rows.is_empty() {
         return crate::router::json_error("PO not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
    }
    let po_row = rows.first().unwrap();
    if po_row.status == "Received" {
        return crate::router::json_error("PO already received", "BAD_REQUEST", &crate::router::get_request_id(&req), 400);
    }

    let now = chrono::Utc::now().to_rfc3339();
    let update_po_stmt = db.prepare("UPDATE purchase_orders SET status = 'Received', received_at = ?1 WHERE id = ?2")
        .bind(&[worker::wasm_bindgen::JsValue::from_str(&now), worker::wasm_bindgen::JsValue::from_str(id_param)])?;

    update_po_stmt.run().await?;

    let lines_stmt = db.prepare("SELECT stock_item_id, quantity FROM po_line_items WHERE po_id = ?1").bind(&[worker::wasm_bindgen::JsValue::from_str(id_param)])?;
    let lines_res: worker::d1::D1Result = lines_stmt.all().await?;

    let line_rows: Vec<LineQty> = lines_res.results()?;

    for l_row in line_rows {
        let qty = Decimal::from_str(&l_row.quantity).unwrap_or(Decimal::ZERO);
        let adj_stmt = db.prepare("UPDATE stock_items SET current_quantity = CAST((CAST(current_quantity AS DECIMAL) + ?1) AS TEXT) WHERE id = ?2")
            .bind(&[worker::wasm_bindgen::JsValue::from_str(&qty.to_string()), worker::wasm_bindgen::JsValue::from_str(&l_row.stock_item_id)])?;
        adj_stmt.run().await?;
    }

    Response::from_json(&serde_json::json!({"success": true}))
}
