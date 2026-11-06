use core_domain::{
    ids::{MenuItemId, RecipeId, StockItemId},
    models::inventory::{Recipe, RecipeIngredient},
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, Result, RouteContext, Router};
use std::str::FromStr;

#[derive(Debug, Deserialize, specta::Type)]
pub struct CreateRecipeIngredientDto {
    pub stock_item_id: StockItemId,
    #[specta(type = String)]
    pub quantity: Decimal,
    #[specta(type = String)]
    pub wastage_percent: Decimal,
}

#[derive(Debug, Deserialize, specta::Type)]
pub struct CreateRecipeRequest {
    pub menu_item_id: MenuItemId,
    pub ingredients: Vec<CreateRecipeIngredientDto>,
    pub preparation_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbRecipe {
    pub id: String,
    pub menu_item_id: String,
    pub preparation_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UnitRow {
    unit: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbRecipeIngredient {
    pub recipe_id: String,
    pub stock_item_id: String,
    pub quantity: String,
    pub unit: String,
    pub wastage_percent: String,
}

pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/recipes", list_recipes)
        .post_async("/api/v1/recipes", create_recipe)
}

/// # Errors
/// Returns an error if authorization fails or database queries fail.
/// # Panics
/// Panics if UUIDs from the database cannot be parsed.
pub async fn list_recipes<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let db = ctx.env.d1("CELLAR_DB")?;
    let recipe_stmt = db
        .prepare("SELECT id, menu_item_id, preparation_notes FROM recipes WHERE tenant_id = ?1 AND location_id = ?2 AND deleted_at IS NULL")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
        ])?;

    let result: worker::d1::D1Result = recipe_stmt.all().await?;
    let recipe_rows: Vec<DbRecipe> = result.results()?;

    let mut recipes = Vec::new();

    for r_row in recipe_rows {
        let recipe_id_uuid = uuid::Uuid::from_str(&r_row.id).unwrap();
        let menu_item_id_uuid = uuid::Uuid::from_str(&r_row.menu_item_id).unwrap();

        let ingredients_stmt = db
            .prepare("SELECT recipe_id, stock_item_id, quantity, unit, wastage_percent FROM recipe_ingredients WHERE recipe_id = ?1")
            .bind(&[worker::wasm_bindgen::JsValue::from_str(&r_row.id)])?;

        let ing_result: worker::d1::D1Result = ingredients_stmt.all().await?;
        let ing_rows: Vec<DbRecipeIngredient> = ing_result.results()?;

        let mut ingredients = Vec::new();
        for i_row in ing_rows {
            let stock_item_id_uuid = uuid::Uuid::from_str(&i_row.stock_item_id).unwrap();
            let unit: core_domain::value_objects::measurement::UnitOfMeasure = serde_json::from_value(serde_json::Value::String(i_row.unit)).unwrap();
            ingredients.push(RecipeIngredient {
                stock_item_id: StockItemId::from(stock_item_id_uuid),
                quantity: core_domain::value_objects::measurement::StockQuantity {
                    value: Decimal::from_str(&i_row.quantity).unwrap_or(Decimal::ZERO),
                    unit,
                },
                wastage_percent: Decimal::from_str(&i_row.wastage_percent).unwrap_or(Decimal::ZERO),
            });
        }

        recipes.push(Recipe {
            id: RecipeId::from(recipe_id_uuid),
            menu_item_id: MenuItemId::from(menu_item_id_uuid),
            ingredients,
            preparation_notes: r_row.preparation_notes,
        });
    }

    Response::from_json(&recipes)
}

/// # Errors
/// Returns an error if authorization fails, the payload is invalid, a stock item is not found, or database insertions fail.
/// # Panics
/// Panics if JSON deserialization of units fails.
pub async fn create_recipe<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let tenant_ctx = match crate::auth::authorize(&req, &ctx, core_domain::enums::staff::Permissions::MANAGE_INVENTORY) {
        Ok(tenant_ctx) => tenant_ctx,
        Err(rejection) => return Ok(rejection),
    };

    let Ok(create_req) = req.json::<CreateRecipeRequest>().await else {
        return crate::router::json_error("Bad Request", "INVALID_PAYLOAD", &crate::router::get_request_id(&req), 400);
    };

    let recipe_id = RecipeId::new();
    let now = chrono::Utc::now().to_rfc3339();
    let db = ctx.env.d1("CELLAR_DB")?;

    let recipe_stmt = db
        .prepare("INSERT INTO recipes (id, tenant_id, location_id, menu_item_id, preparation_notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(&[
            worker::wasm_bindgen::JsValue::from_str(&recipe_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.location_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&create_req.menu_item_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&create_req.preparation_notes.clone().unwrap_or_default()),
            worker::wasm_bindgen::JsValue::from_str(&now),
        ])?;
    recipe_stmt.run().await?;

    let mut ingredients = Vec::new();

    for ing_req in &create_req.ingredients {
        let unit_stmt = db.prepare("SELECT unit FROM stock_items WHERE id = ?1 AND tenant_id = ?2").bind(&[
            worker::wasm_bindgen::JsValue::from_str(&ing_req.stock_item_id.to_string()),
            worker::wasm_bindgen::JsValue::from_str(&tenant_ctx.tenant_id.to_string()),
        ])?;

        let u_res: worker::d1::D1Result = unit_stmt.all().await?;
        let mut u_rows: Vec<UnitRow> = u_res.results()?;
        if u_rows.is_empty() {
             return crate::router::json_error("Stock item not found", "NOT_FOUND", &crate::router::get_request_id(&req), 404);
        }
        let u_row = u_rows.remove(0);
        let unit: core_domain::value_objects::measurement::UnitOfMeasure = serde_json::from_value(serde_json::Value::String(u_row.unit.clone())).unwrap();

        let ing_id = uuid::Uuid::now_v7();
        let ing_stmt = db
            .prepare("INSERT INTO recipe_ingredients (id, recipe_id, stock_item_id, quantity, unit, wastage_percent) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
            .bind(&[
                worker::wasm_bindgen::JsValue::from_str(&ing_id.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&recipe_id.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&ing_req.stock_item_id.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&ing_req.quantity.to_string()),
                worker::wasm_bindgen::JsValue::from_str(&u_row.unit),
                worker::wasm_bindgen::JsValue::from_str(&ing_req.wastage_percent.to_string()),
            ])?;
        ing_stmt.run().await?;

        ingredients.push(RecipeIngredient {
            stock_item_id: ing_req.stock_item_id,
            quantity: core_domain::value_objects::measurement::StockQuantity {
                value: ing_req.quantity,
                unit,
            },
            wastage_percent: ing_req.wastage_percent,
        });
    }

    let recipe = Recipe {
        id: recipe_id,
        menu_item_id: create_req.menu_item_id,
        ingredients,
        preparation_notes: create_req.preparation_notes,
    };

    Response::from_json(&recipe)
}
