
use core_domain::{
    events::stock::StockAdjustmentReason,
    ids::StockItemId,
    models::inventory::StockItem,
    value_objects::{
        measurement::{StockQuantity, UnitOfMeasure},
        money::Money,
    },
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use worker::{Error, Request, Response, Result, RouteContext, Router};

#[derive(Debug, Deserialize, specta::Type)]
pub struct InventoryQueryParams {
    pub below_reorder: Option<bool>,
    pub is_active: Option<bool>,
    pub unit: Option<UnitOfMeasure>,
}

#[derive(Debug, Deserialize, specta::Type)]
pub struct AdjustStockRequest {
    pub stock_item_id: StockItemId,
    #[specta(type = String)]
    pub delta: Decimal,
    pub reason: StockAdjustmentReason,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct StockItemResponseDto {
    pub id: StockItemId,
    pub name: String,
    pub unit: UnitOfMeasure,
    #[specta(type = String)]
    pub current_quantity: Decimal,
    #[specta(type = String)]
    pub par_level: Decimal,
    #[specta(type = String)]
    pub reorder_level: Decimal,
    pub cost_per_unit: Money,
    pub is_active: bool,
    pub is_below_reorder: bool,
}

impl From<&StockItem> for StockItemResponseDto {
    fn from(item: &StockItem) -> Self {
        Self {
            id: item.id,
            name: item.name.clone(),
            unit: item.unit,
            current_quantity: item.current_quantity.value,
            par_level: item.par_level.value,
            reorder_level: item.reorder_level.value,
            cost_per_unit: item.cost_per_unit.clone(),
            is_active: item.is_active,
            is_below_reorder: item.is_below_reorder(),
        }
    }
}

#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/inventory", get_inventory)
        .post_async("/api/v1/inventory/adjust", adjust_stock)
}

#[derive(Deserialize)]
struct DbStockItem {
    id: String,
    name: String,
    unit: String,
    current_quantity: String,
    par_level: String,
    reorder_level: String,
    cost_per_unit_amount: String,
    cost_per_unit_currency: String,
    is_active: bool,
}

#[derive(Serialize)]
struct AuditPayload {
    old_qty: String,
    new_qty: String,
    delta: String,
    reason: StockAdjustmentReason,
    notes: Option<String>,
    event: core_domain::events::stock::StockEvent,
}

#[derive(Serialize)]
struct AdjustResponse {
    #[serde(flatten)]
    item: StockItemResponseDto,
}

/// Retrieves inventory list based on query filters.
///
/// # Errors
///
/// Returns an error if database operations fail, data binding fails, or invalid context is passed.
pub async fn get_inventory<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", core_domain::enums::staff::Permissions::empty()) else {
        return Response::error("Unauthorized", 401);
    };

    let url = req.url()?;
    let query: std::collections::HashMap<String, String> = url.query_pairs().into_owned().collect();

    let is_active_filter = query.get("is_active").is_none_or(|v| v == "true");
    let below_reorder = query.get("below_reorder").map(|v| v == "true");
    let unit_filter: Option<UnitOfMeasure> = query
        .get("unit")
        .and_then(|v| serde_json::from_str(&format!("\"{v}\"")).ok());

    let db = ctx.env.d1("CELLAR_DB")?;

    let statement = db
        .prepare(
            "SELECT id, name, unit, current_quantity, par_level, reorder_level, cost_per_unit_amount, cost_per_unit_currency, is_active
         FROM stock_items
         WHERE tenant_id = ?1 AND location_id = ?2 AND is_active = ?3",
        )
        .bind(&[
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
            is_active_filter.into(),
        ])?;

    let result: worker::d1::D1Result = statement.all().await?;
    let rows: Vec<DbStockItem> = result.results()?;

    let mut dtos = Vec::new();

    for row in rows {
        let unit: UnitOfMeasure = serde_json::from_value(serde_json::Value::String(row.unit))
            .map_err(|_| Error::RustError("Invalid unit in DB".into()))?;

        if let Some(filter_unit) = unit_filter {
            if filter_unit != unit {
                continue;
            }
        }

        let id_uuid = uuid::Uuid::from_str(&row.id)
            .map_err(|_| Error::RustError("Invalid UUID".into()))?;

        let stock_item = StockItem {
            id: StockItemId::from(id_uuid),
            tenant_id: tenant_ctx.tenant_id,
            location_id: tenant_ctx.location_id,
            name: row.name,
            unit,
            current_quantity: StockQuantity {
                value: Decimal::from_str(&row.current_quantity)
                    .map_err(|_| Error::RustError("Invalid decimal".into()))?,
                unit,
            },
            par_level: StockQuantity {
                value: Decimal::from_str(&row.par_level)
                    .map_err(|_| Error::RustError("Invalid decimal".into()))?,
                unit,
            },
            reorder_level: StockQuantity {
                value: Decimal::from_str(&row.reorder_level)
                    .map_err(|_| Error::RustError("Invalid decimal".into()))?,
                unit,
            },
            cost_per_unit: Money {
                amount: Decimal::from_str(&row.cost_per_unit_amount)
                    .map_err(|_| Error::RustError("Invalid decimal".into()))?,
                currency: serde_json::from_value(serde_json::Value::String(
                    row.cost_per_unit_currency,
                ))
                .map_err(|_| Error::RustError("Invalid currency".into()))?,
            },
            is_active: row.is_active,
            deleted_at: None,
        };

        if let Some(below) = below_reorder {
            if below && !stock_item.is_below_reorder() {
                continue;
            }
        }

        dtos.push(StockItemResponseDto::from(&stock_item));
    }

    Response::from_json(&dtos)
}

/// Adjusts the stock quantity for a stock item based on the adjust request.
///
/// # Errors
///
/// Returns an error if database updates fail, JSON parsing fails, or context is invalid.
#[allow(clippy::too_many_lines)]
pub async fn adjust_stock<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(&req, "", core_domain::enums::staff::Permissions::empty()) else {
        return Response::error("Unauthorized", 401);
    };

    let Ok(adjust_req) = req.json::<AdjustStockRequest>().await else {
        return Response::error("Bad Request", 400);
    };

    let db = ctx.env.d1("CELLAR_DB")?;

    let statement = db
        .prepare(
            "SELECT id, name, unit, current_quantity, par_level, reorder_level, cost_per_unit_amount, cost_per_unit_currency, is_active
         FROM stock_items
         WHERE id = ?1 AND tenant_id = ?2 AND location_id = ?3",
        )
        .bind(&[
            adjust_req.stock_item_id.to_string().into(),
            tenant_ctx.tenant_id.to_string().into(),
            tenant_ctx.location_id.to_string().into(),
        ])?;

    let result: worker::d1::D1Result = statement.all().await?;
    let mut rows: Vec<DbStockItem> = result.results()?;

    if rows.is_empty() {
        return Response::error("Not Found", 404);
    }

    let row = rows.remove(0);

    let unit: UnitOfMeasure = serde_json::from_value(serde_json::Value::String(row.unit))
        .map_err(|_| Error::RustError("Invalid unit in DB".into()))?;

    let id_uuid = uuid::Uuid::from_str(&row.id)
        .map_err(|_| Error::RustError("Invalid UUID".into()))?;

    let mut stock_item = StockItem {
        id: StockItemId::from(id_uuid),
        tenant_id: tenant_ctx.tenant_id,
        location_id: tenant_ctx.location_id,
        name: row.name,
        unit,
        current_quantity: StockQuantity {
            value: Decimal::from_str(&row.current_quantity)
                .map_err(|_| Error::RustError("Invalid decimal".into()))?,
            unit,
        },
        par_level: StockQuantity {
            value: Decimal::from_str(&row.par_level)
                .map_err(|_| Error::RustError("Invalid decimal".into()))?,
            unit,
        },
        reorder_level: StockQuantity {
            value: Decimal::from_str(&row.reorder_level)
                .map_err(|_| Error::RustError("Invalid decimal".into()))?,
            unit,
        },
        cost_per_unit: Money {
            amount: Decimal::from_str(&row.cost_per_unit_amount)
                .map_err(|_| Error::RustError("Invalid decimal".into()))?,
            currency: serde_json::from_value(serde_json::Value::String(
                row.cost_per_unit_currency,
            ))
            .map_err(|_| Error::RustError("Invalid currency".into()))?,
        },
        is_active: row.is_active,
        deleted_at: None,
    };

    let old_qty = stock_item.current_quantity.value;
    let (event, _) = stock_item.adjust_stock(adjust_req.delta, adjust_req.reason.clone(), None);

    let update_stmt = db
        .prepare("UPDATE stock_items SET current_quantity = ?1 WHERE id = ?2 AND current_quantity = ?3")
        .bind(&[
            stock_item.current_quantity.value.to_string().into(),
            stock_item.id.to_string().into(),
            old_qty.to_string().into(),
        ])?;

    let payload_json = serde_json::to_string(&AuditPayload {
        old_qty: old_qty.to_string(),
        new_qty: stock_item.current_quantity.value.to_string(),
        delta: adjust_req.delta.to_string(),
        reason: adjust_req.reason,
        notes: adjust_req.notes,
        event,
    })
    .map_err(|e| Error::RustError(e.to_string()))?;

    let audit_stmt = db.prepare(
        "INSERT INTO audit_events (id, tenant_id, location_id, action, target_id, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(&[
        uuid::Uuid::now_v7().to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
        "STOCK_ADJUSTED".into(),
        stock_item.id.to_string().into(),
        payload_json.into(),
        chrono::Utc::now().to_rfc3339().into(),
    ])?;

    // Check OCC by executing update first
    let update_result: worker::d1::D1Result = update_stmt.run().await?;

    if !update_result.success() || update_result.meta().map_or(0, |m| m.map_or(0, |inner_m| inner_m.changes.unwrap_or(0))) == 0 {
        return Response::error("Conflict: Stock quantity was updated by another process", 409);
    }

    // Insert audit ONLY if update succeeded
    audit_stmt.run().await?;

    let dto = StockItemResponseDto::from(&stock_item);

    Response::from_json(&AdjustResponse { item: dto })
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::{
        events::stock::StockAdjustmentReason,
        ids::{LocationId, StockItemId, TenantId},
        models::inventory::StockItem,
        value_objects::{
            measurement::{StockQuantity, UnitOfMeasure},
            money::{Currency, Money},
        },
    };
    use rust_decimal::Decimal;

    fn create_test_stock_item(current_qty: i64, reorder_lvl: i64, unit: UnitOfMeasure) -> StockItem {
        StockItem {
            id: StockItemId::new(),
            tenant_id: TenantId::new(),
            location_id: LocationId::new(),
            name: "Test Item".to_string(),
            unit,
            current_quantity: StockQuantity {
                value: Decimal::new(current_qty, 0),
                unit,
            },
            par_level: StockQuantity {
                value: Decimal::new(100, 0),
                unit,
            },
            reorder_level: StockQuantity {
                value: Decimal::new(reorder_lvl, 0),
                unit,
            },
            cost_per_unit: Money {
                amount: Decimal::new(100, 0),
                currency: Currency::Inr,
            },
            is_active: true,
            deleted_at: None,
        }
    }

    #[test]
    fn test_stock_item_dto_mapping() {
        let item = create_test_stock_item(10, 15, UnitOfMeasure::Kilogram);
        let dto = StockItemResponseDto::from(&item);

        assert_eq!(dto.id, item.id);
        assert_eq!(dto.name, item.name);
        assert_eq!(dto.unit, UnitOfMeasure::Kilogram);
        assert_eq!(dto.current_quantity, Decimal::new(10, 0));
        assert!(dto.is_below_reorder); // 10 <= 15
    }

    #[test]
    fn test_dto_not_below_reorder() {
        let item = create_test_stock_item(20, 15, UnitOfMeasure::Kilogram);
        let dto = StockItemResponseDto::from(&item);

        assert!(!dto.is_below_reorder); // 20 > 15
    }

    #[test]
    fn test_positive_and_negative_stock_adjustments() {
        let mut item = create_test_stock_item(50, 20, UnitOfMeasure::Kilogram);

        // Positive Adjustment (Goods Receipt)
        let delta = Decimal::new(25, 0);
        let (event, is_negative) = item.adjust_stock(delta, StockAdjustmentReason::PurchaseReceived, None);

        assert_eq!(item.current_quantity.value, Decimal::new(75, 0));
        assert!(!is_negative);
        assert!(!item.is_below_reorder());

        match event {
            core_domain::events::stock::StockEvent::QuantityAdjusted { old_quantity_str, new_quantity_str, reason, .. } => {
                assert_eq!(old_quantity_str, "50");
                assert_eq!(new_quantity_str, "75");
                assert_eq!(reason, StockAdjustmentReason::PurchaseReceived);
            },
            _ => panic!("Expected QuantityAdjusted event"),
        }

        // Negative Adjustment (Spoilage)
        let negative_delta = Decimal::new(-60, 0); // 75 - 60 = 15
        let (event, is_negative) = item.adjust_stock(negative_delta, StockAdjustmentReason::SpoilageWaste, None);

        assert_eq!(item.current_quantity.value, Decimal::new(15, 0));
        assert!(!is_negative);
        assert!(item.is_below_reorder()); // 15 <= 20

        match event {
            core_domain::events::stock::StockEvent::QuantityAdjusted { old_quantity_str, new_quantity_str, reason, .. } => {
                assert_eq!(old_quantity_str, "75");
                assert_eq!(new_quantity_str, "15");
                assert_eq!(reason, StockAdjustmentReason::SpoilageWaste);
            },
            _ => panic!("Expected QuantityAdjusted event"),
        }
    }

    #[test]
    fn test_decimal_precision_conservation() {
        // Test precision like 1.250 kg + 0.750 kg = 2.000 kg
        let mut item = create_test_stock_item(0, 0, UnitOfMeasure::Kilogram);
        item.current_quantity.value = Decimal::new(1250, 3); // 1.250

        let delta = Decimal::new(750, 3); // 0.750
        item.adjust_stock(delta, StockAdjustmentReason::OrderDeduction, None);

        assert_eq!(item.current_quantity.value, Decimal::new(2000, 3)); // 2.000
    }
}
