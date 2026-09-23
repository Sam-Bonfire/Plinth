use core_domain::ids::{MenuCategoryId, MenuItemId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicMenuItemDto {
    pub id: MenuItemId,
    pub name: String,
    pub description: Option<String>,
    #[specta(type = f64)]
    pub price_minor: i64,
    pub is_veg: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicMenuCategoryDto {
    pub id: MenuCategoryId,
    pub name: String,
    pub items: Vec<PublicMenuItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PublicMenuCatalogResponseDto {
    pub categories: Vec<PublicMenuCategoryDto>,
}

use worker::{wasm_bindgen::JsValue, Request, Response, Result, RouteContext, Router};
use std::str::FromStr;

#[derive(Debug, Deserialize)]
struct RawCategoryRow {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct RawMenuItemRow {
    id: String,
    primary_category_id: String,
    name: String,
    description: Option<String>,
    price_minor: i64,
    is_veg: i64,
}

pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router.get_async("/api/v1/public/menu", get_public_menu)
}

/// Retrieves the public menu catalog.
///
/// # Errors
/// Returns an error if the `tenant_id` is missing/invalid, database query fails, or JSON serialization fails.
pub async fn get_public_menu<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let url = req.url()?;
    let tenant_id_str = url.query_pairs().find(|(k, _)| k == "tenant_id").map(|(_, v)| v.into_owned());
    
    let Some(tenant_id_str) = tenant_id_str else {
        return crate::router::json_error("Missing tenant_id", "INVALID_REQUEST", &crate::router::get_request_id(&req), 400);
    };
    
    if uuid::Uuid::from_str(&tenant_id_str).is_err() {
        return crate::router::json_error("Invalid tenant_id", "INVALID_REQUEST", &crate::router::get_request_id(&req), 400);
    }
    
    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return crate::router::json_error(format!("Database error: {e}"), "INTERNAL_ERROR", &crate::router::get_request_id(&req), 500),
    };
    
    let cat_query = "SELECT id, name FROM menu_categories WHERE tenant_id = ? AND is_active = 1 AND deleted_at IS NULL ORDER BY display_order ASC";
    let cat_params: Vec<JsValue> = vec![tenant_id_str.clone().into()];
    let cat_stmt = db.prepare(cat_query).bind(&cat_params)?;
    let cat_res = cat_stmt.all().await?;
    let raw_categories: Vec<RawCategoryRow> = cat_res.results()?;

    let item_query = "SELECT id, primary_category_id, name, description, price_minor, is_veg FROM menu_items WHERE tenant_id = ? AND is_available = 1 AND deleted_at IS NULL LIMIT 100";
    let item_stmt = db.prepare(item_query).bind(&cat_params)?;
    let item_res = item_stmt.all().await?;
    let raw_items: Vec<RawMenuItemRow> = item_res.results()?;
    
    let mut categories = Vec::with_capacity(raw_categories.len());

    for cat in raw_categories {
        let cat_id = match cat.id.parse::<uuid::Uuid>() {
            Ok(id) => MenuCategoryId::from(id),
            Err(_) => continue,
        };

        let mut cat_items = Vec::new();

        for item in &raw_items {
            if item.primary_category_id == cat.id {
                let item_id = match item.id.parse::<uuid::Uuid>() {
                    Ok(id) => MenuItemId::from(id),
                    Err(_) => continue,
                };
                
                cat_items.push(PublicMenuItemDto {
                    id: item_id,
                    name: item.name.clone(),
                    description: item.description.clone(),
                    price_minor: item.price_minor,
                    is_veg: item.is_veg == 1,
                });
            }
        }

        if !cat_items.is_empty() {
            categories.push(PublicMenuCategoryDto {
                id: cat_id,
                name: cat.name,
                items: cat_items,
            });
        }
    }
    
    let res_dto = PublicMenuCatalogResponseDto { categories };
    Response::from_json(&res_dto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_dto_serialization() {
        let cat_id = MenuCategoryId::from(Uuid::now_v7());
        let item_id = MenuItemId::from(Uuid::now_v7());
        
        let item = PublicMenuItemDto {
            id: item_id,
            name: "Burger".to_string(),
            description: Some("Delicious burger".to_string()),
            price_minor: 500,
            is_veg: false,
        };

        let cat = PublicMenuCategoryDto {
            id: cat_id,
            name: "Mains".to_string(),
            items: vec![item],
        };

        let resp = PublicMenuCatalogResponseDto {
            categories: vec![cat],
        };

        let serialized = serde_json::to_string(&resp).unwrap();
        assert!(serialized.contains("Burger"));
        assert!(serialized.contains("500"));
        assert!(serialized.contains("Mains"));
    }
}
