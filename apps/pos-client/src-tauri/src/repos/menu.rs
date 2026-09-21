#![forbid(unsafe_code)]

//! `SQLite` [`MenuRepository`] over `menu_categories` and `menu_items`.
//!
//! Fidelity ceiling: `category_tags`, `modifier_groups`, and the pricing
//! validity window have no columns and are not persisted; price, flags, and
//! station round-trip exactly.

use super::{from_json, id_from_text, minor, opt_time_from_text, to_json, Store};
use chrono::Utc;
use core_domain::ids::{LocationId, MenuItemId, TenantId};
use core_domain::models::{MenuCategory, MenuItem};
use core_domain::ports::{MenuRepository, PortError};
use core_domain::value_objects::pricing::PricingVersion;
use rusqlite::{params, OptionalExtension};
use std::path::PathBuf;

type MenuItemRow = (
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    i64,
    String,
    i64,
    i64,
    Option<String>,
    String,
    Option<String>,
);

#[derive(Debug, Clone)]
pub struct SqliteMenuRepository {
    store: Store,
}

impl SqliteMenuRepository {
    #[must_use]
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            store: Store::new(db_path),
        }
    }

    fn read_item(&self, id: &str) -> Result<Option<MenuItem>, PortError> {
        let conn = self.store.conn()?;
        let row: Option<MenuItemRow> = conn
            .query_row(
                "SELECT id, tenant_id, location_id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station, deleted_at FROM menu_items WHERE id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                        row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?,
                        row.get(8)?, row.get(9)?, row.get(10)?, row.get(11)?,
                        row.get(12)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let Some((
            id,
            tenant,
            location,
            category,
            name,
            description,
            price,
            tax,
            veg,
            available,
            sku,
            station,
            deleted,
        )) = row
        else {
            return Ok(None);
        };
        let category_id = id_from_text(&category)?;
        Ok(Some(MenuItem {
            id: id_from_text(&id)?,
            tenant_id: id_from_text(&tenant)?,
            location_id: id_from_text(&location)?,
            primary_category_id: category_id,
            category_tags: vec![category_id],
            name,
            description,
            pricing: PricingVersion {
                price: minor(price),
                effective_from: Utc::now(),
                effective_until: None,
            },
            modifier_groups: Vec::new(),
            tax_rate: from_json(&tax)?,
            is_veg: veg != 0,
            is_available: available != 0,
            sku,
            kitchen_station: from_json(&station)?,
            deleted_at: opt_time_from_text(deleted)?,
        }))
    }
}

impl MenuRepository for SqliteMenuRepository {
    fn save_category(
        &self,
        category: &MenuCategory,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        let result = (|| -> Result<(), PortError> {
            let conn = self.store.conn()?;
            conn.execute(
                "INSERT INTO menu_categories (id, tenant_id, location_id, name, display_order, is_active, deleted_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, display_order = excluded.display_order,
                     is_active = excluded.is_active, deleted_at = excluded.deleted_at",
                params![
                    category.id.to_string(),
                    category.tenant_id.to_string(),
                    category.location_id.to_string(),
                    category.name,
                    category.display_order,
                    i64::from(category.is_active),
                    category.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
            Ok(())
        })();
        std::future::ready(result)
    }

    fn save_item(
        &self,
        item: &MenuItem,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        let result = (|| -> Result<(), PortError> {
            let conn = self.store.conn()?;
            conn.execute(
                "INSERT INTO menu_items (id, tenant_id, location_id, primary_category_id, name, description, price_minor, tax_rate, is_veg, is_available, sku, kitchen_station, deleted_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
                     price_minor = excluded.price_minor, tax_rate = excluded.tax_rate, is_veg = excluded.is_veg,
                     is_available = excluded.is_available, sku = excluded.sku,
                     kitchen_station = excluded.kitchen_station, deleted_at = excluded.deleted_at",
                params![
                    item.id.to_string(),
                    item.tenant_id.to_string(),
                    item.location_id.to_string(),
                    item.primary_category_id.to_string(),
                    item.name,
                    item.description,
                    item.pricing.price.to_minor_units(),
                    to_json(&item.tax_rate)?,
                    i64::from(item.is_veg),
                    i64::from(item.is_available),
                    item.sku,
                    to_json(&item.kitchen_station)?,
                    item.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
            Ok(())
        })();
        std::future::ready(result)
    }

    fn find_item(
        &self,
        id: MenuItemId,
    ) -> impl std::future::Future<Output = Result<Option<MenuItem>, PortError>> + Send {
        std::future::ready(self.read_item(&id.to_string()))
    }

    fn query_available(
        &self,
        tenant_id: TenantId,
        location_id: LocationId,
    ) -> impl std::future::Future<Output = Result<Vec<MenuItem>, PortError>> + Send {
        let result = (|| -> Result<Vec<MenuItem>, PortError> {
            let conn = self.store.conn()?;
            let mut stmt = conn
                .prepare("SELECT id FROM menu_items WHERE tenant_id = ?1 AND location_id = ?2 AND is_available = 1 AND deleted_at IS NULL ORDER BY name")
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let ids: Vec<String> = stmt
                .query_map(
                    params![tenant_id.to_string(), location_id.to_string()],
                    |row| row.get(0),
                )
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?
                .collect::<Result<_, _>>()
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let mut out = Vec::new();
            for id in &ids {
                if let Some(item) = self.read_item(id)? {
                    out.push(item);
                }
            }
            Ok(out)
        })();
        std::future::ready(result)
    }

    fn set_availability(
        &self,
        id: MenuItemId,
        available: bool,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        let result = (|| -> Result<(), PortError> {
            let conn = self.store.conn()?;
            let changed = conn
                .execute(
                    "UPDATE menu_items SET is_available = ?1 WHERE id = ?2",
                    params![i64::from(available), id.to_string()],
                )
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            if changed == 0 {
                return Err(PortError::NotFound {
                    entity: "MenuItem",
                    id: id.to_string(),
                });
            }
            Ok(())
        })();
        std::future::ready(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repos::tests::{cleanup, migrated_file_db};
    use core_domain::enums::kitchen::StationId;
    use core_domain::ids::{LocationId, MenuCategoryId, MenuItemId, TenantId};
    use core_domain::value_objects::money::{Currency, Money};
    use core_domain::value_objects::pricing::PricingVersion;
    use core_domain::value_objects::tax::GstRate;
    use rust_decimal::Decimal;

    fn sample_item(category: MenuCategoryId) -> MenuItem {
        let mut item = MenuItem::new(
            MenuItemId::new(),
            TenantId::new(),
            LocationId::new(),
            category,
            "Paneer Tikka".to_string(),
            PricingVersion {
                price: Money {
                    amount: Decimal::new(320, 0),
                    currency: Currency::Inr,
                },
                effective_from: Utc::now(),
                effective_until: None,
            },
            GstRate::FivePercent,
            true,
            StationId::Tandoor,
        );
        item.sku = Some("PT-01".to_string());
        item
    }

    #[tokio::test]
    async fn round_trip_and_availability_toggle() {
        let (_conn, path) = migrated_file_db("menu-rt");
        let repo = SqliteMenuRepository::new(path.clone());
        let category = MenuCategory::new(
            MenuCategoryId::new(),
            TenantId::new(),
            LocationId::new(),
            "Starters".to_string(),
            1,
        );
        repo.save_category(&category).await.expect("save category");
        let mut item = sample_item(category.id);
        item.tenant_id = category.tenant_id;
        item.location_id = category.location_id;
        repo.save_item(&item).await.expect("save item");
        let back = repo
            .find_item(item.id)
            .await
            .expect("find")
            .expect("present");
        assert_eq!(back.name, "Paneer Tikka");
        assert_eq!(back.pricing.price.to_minor_units(), 32000);
        assert!(back.is_available);
        repo.set_availability(item.id, false).await.expect("toggle");
        assert!(
            !repo
                .find_item(item.id)
                .await
                .expect("find")
                .expect("present")
                .is_available
        );
        assert!(repo
            .query_available(category.tenant_id, category.location_id)
            .await
            .expect("query")
            .is_empty());
        cleanup(&path);
    }

    #[tokio::test]
    async fn toggle_missing_item_reports_not_found() {
        let (_conn, path) = migrated_file_db("menu-miss");
        let repo = SqliteMenuRepository::new(path.clone());
        let err = repo
            .set_availability(MenuItemId::new(), false)
            .await
            .expect_err("must fail");
        assert!(matches!(err, PortError::NotFound { .. }));
        cleanup(&path);
    }
}
