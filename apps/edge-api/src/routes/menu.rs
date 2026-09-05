use crate::dto::menu::{
    MenuCatalogResponseDto, MenuItemDto, NestedMenuCategoryDto, UpdateItemAvailabilityRequest,
};
use core_domain::{
    enums::kitchen::StationId,
    enums::staff::Permissions,
    events::catalog::CatalogEvent,
    ids::{MenuCategoryId, MenuItemId},
    value_objects::tax::GstRate,
};
use serde::Deserialize;
use worker::{
    wasm_bindgen::JsValue,
    Error, Request, Response, Result, RouteContext, Router,
};

#[derive(Debug, Deserialize)]
struct RawCategoryRow {
    id: String,
    name: String,
    display_order: u16,
    is_active: i64,
}

#[derive(Debug, Deserialize)]
struct RawMenuItemRow {
    id: String,
    primary_category_id: String,
    name: String,
    description: Option<String>,
    price_minor: i64,
    tax_rate: String,
    is_veg: i64,
    is_available: i64,
    sku: Option<String>,
    kitchen_station: String,
}

/// Registers the Menu Catalog routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/menu", get_menu_catalog)
        .patch_async("/api/v1/menu/items/:id/availability", update_item_availability)
}

/// Retrieves the complete menu catalog categorized and sorted
///
/// # Errors
/// Returns an error if the database query fails or authentication context is invalid
pub async fn get_menu_catalog<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
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

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let cat_query = "SELECT id, name, display_order, is_active FROM menu_categories WHERE tenant_id = ? AND location_id = ? AND deleted_at IS NULL ORDER BY display_order ASC";
    let cat_params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];
    let cat_stmt = db.prepare(cat_query).bind(&cat_params)?;
    let cat_res = cat_stmt.all().await?;
    let raw_categories: Vec<RawCategoryRow> = cat_res.results()?;

    let item_query = "SELECT id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station FROM menu_items WHERE tenant_id = ? AND location_id = ? AND deleted_at IS NULL";
    let item_stmt = db.prepare(item_query).bind(&cat_params)?;
    let item_res = item_stmt.all().await?;
    let raw_items: Vec<RawMenuItemRow> = item_res.results()?;

    let mut nested_categories = Vec::with_capacity(raw_categories.len());

    for cat in raw_categories {
        let cat_id = cat
            .id
            .parse::<uuid::Uuid>()
            .map(MenuCategoryId::from)
            .map_err(|_| Error::RustError("Invalid category ID".into()))?;

        let mut cat_items = Vec::new();

        for item in &raw_items {
            if item.primary_category_id == cat.id {
                let item_id = item
                    .id
                    .parse::<uuid::Uuid>()
                    .map(MenuItemId::from)
                    .map_err(|_| Error::RustError("Invalid item ID".into()))?;

                let tax_rate = match item.tax_rate.as_str() {
                    "Exempt" | "0" => GstRate::Exempt,
                    "TwelvePercent" | "12" | "12%" => GstRate::TwelvePercent,
                    "EighteenPercent" | "18" | "18%" => GstRate::EighteenPercent,
                    "TwentyEightPercent" | "28" | "28%" => GstRate::TwentyEightPercent,
                    _ => GstRate::FivePercent,
                };

                let kitchen_station = match item.kitchen_station.as_str() {
                    "Grill" => StationId::Grill,
                    "Tandoor" => StationId::Tandoor,
                    "ColdStation" => StationId::ColdStation,
                    "Beverages" => StationId::Beverages,
                    "Desserts" => StationId::Desserts,
                    "MainKitchen" => StationId::MainKitchen,
                    other => StationId::Custom(other.to_string()),
                };

                cat_items.push(MenuItemDto {
                    id: item_id,
                    primary_category_id: cat_id,
                    name: item.name.clone(),
                    description: item.description.clone(),
                    price_minor: item.price_minor,
                    tax_rate,
                    is_veg: item.is_veg != 0,
                    is_available: item.is_available != 0,
                    sku: item.sku.clone(),
                    kitchen_station,
                });
            }
        }

        nested_categories.push(NestedMenuCategoryDto {
            id: cat_id,
            name: cat.name,
            display_order: cat.display_order,
            is_active: cat.is_active != 0,
            items: cat_items,
        });
    }

    let response_dto = MenuCatalogResponseDto {
        categories: nested_categories,
    };

    let mut response = Response::from_json(&response_dto)?;
    response.headers_mut().set("Cache-Control", "public, max-age=10, stale-while-revalidate=30")?;

    Ok(response)
}

/// Updates the availability of a menu item (Item 86 toggle)
///
/// # Errors
/// Returns an error if the item is not found, user lacks permissions, or database update fails
pub async fn update_item_availability<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Some(secret) = crate::auth::resolve_jwt_secret(&ctx) else {
        return Response::error("Forbidden: Insufficient permissions", 403);
    };
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        &secret,
        Permissions::MANAGE_MENU,
    ) else {
        return Response::error("Forbidden: Insufficient permissions", 403);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let Some(item_id_str) = ctx.param("id") else {
        return Response::error("Missing item ID parameter", 400);
    };

    let Ok(update_req) = req.json::<UpdateItemAvailabilityRequest>().await else {
        return Response::error("Invalid JSON payload", 400);
    };

    let is_avail_int = i64::from(update_req.is_available);

    let update_query = "UPDATE menu_items SET is_available = ? WHERE id = ? AND tenant_id = ? AND location_id = ?";
    let update_params: Vec<JsValue> = vec![
        is_avail_int.into(),
        item_id_str.clone().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    let update_stmt = db.prepare(update_query).bind(&update_params)?;
    let _ = update_stmt.run().await?;

    let fetch_query = "SELECT id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station FROM menu_items WHERE id = ? AND tenant_id = ? AND location_id = ?";
    let fetch_params: Vec<JsValue> = vec![
        item_id_str.clone().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];
    let fetch_stmt = db.prepare(fetch_query).bind(&fetch_params)?;
    let fetch_res = fetch_stmt.all().await?;
    let raw_items: Vec<RawMenuItemRow> = fetch_res.results()?;

    let Some(item) = raw_items.into_iter().next() else {
        return Response::error("Menu item not found", 404);
    };

    let item_id = item
        .id
        .parse::<uuid::Uuid>()
        .map(MenuItemId::from)
        .map_err(|_| Error::RustError("Invalid item ID".into()))?;

    let primary_cat_id = item
        .primary_category_id
        .parse::<uuid::Uuid>()
        .map(MenuCategoryId::from)
        .map_err(|_| Error::RustError("Invalid category ID".into()))?;

    let tax_rate = match item.tax_rate.as_str() {
        "Exempt" | "0" => GstRate::Exempt,
        "TwelvePercent" | "12" | "12%" => GstRate::TwelvePercent,
        "EighteenPercent" | "18" | "18%" => GstRate::EighteenPercent,
        "TwentyEightPercent" | "28" | "28%" => GstRate::TwentyEightPercent,
        _ => GstRate::FivePercent,
    };

    let kitchen_station = match item.kitchen_station.as_str() {
        "Grill" => StationId::Grill,
        "Tandoor" => StationId::Tandoor,
        "ColdStation" => StationId::ColdStation,
        "Beverages" => StationId::Beverages,
        "Desserts" => StationId::Desserts,
        "MainKitchen" => StationId::MainKitchen,
        other => StationId::Custom(other.to_string()),
    };

    let updated_dto = MenuItemDto {
        id: item_id,
        primary_category_id: primary_cat_id,
        name: item.name,
        description: item.description,
        price_minor: item.price_minor,
        tax_rate,
        is_veg: item.is_veg != 0,
        is_available: item.is_available != 0,
        sku: item.sku,
        kitchen_station,
    };

    let _event = CatalogEvent::MenuItemAvailabilityChanged {
        menu_item_id: item_id,
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        is_available: update_req.is_available,
        reason: update_req.reason,
        changed_by: Some(tenant_ctx.staff_id),
        changed_at: chrono::Utc::now(),
    };

    Response::from_json(&updated_dto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::ids::MenuCategoryId;

    #[test]
    fn test_menu_category_dto_serialization() {
        let cat = crate::dto::menu::MenuCategoryDto {
            id: MenuCategoryId::new(),
            name: "Starters & Appetizers".to_string(),
            display_order: 1,
            is_active: true,
        };

        let json = serde_json::to_string(&cat).unwrap();
        assert!(json.contains("Starters & Appetizers"));
        assert!(json.contains("\"is_active\":true"));
    }

    #[test]
    fn test_menu_item_dto_tax_and_station() {
        let item = MenuItemDto {
            id: MenuItemId::new(),
            primary_category_id: MenuCategoryId::new(),
            name: "Paneer Tikka".to_string(),
            description: Some("Marinated cottage cheese char-grilled".to_string()),
            price_minor: 32000,
            tax_rate: GstRate::FivePercent,
            is_veg: true,
            is_available: true,
            sku: Some("DS-001".to_string()),
            kitchen_station: StationId::Tandoor,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("Paneer Tikka"));
        assert!(json.contains("Tandoor"));
        assert!(json.contains("FivePercent"));
    }
}
