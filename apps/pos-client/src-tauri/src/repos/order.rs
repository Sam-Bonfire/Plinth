#![forbid(unsafe_code)]

//! `SQLite` [`OrderRepository`] over the `orders`, `order_line_items`, and
//! `order_payments` tables.
//!
//! Fidelity ceiling: discounts, charges, tips, and `split_from` have no
//! columns and are not persisted; line-item modifier breakdowns collapse into
//! `unit_price_minor` (line totals round-trip exactly). Full-fidelity order
//! history travels in sync-queue events, not this operational cache.

use super::{from_json, id_from_text, minor, opt_time_from_text, time_from_text, to_json, Store};
use core_domain::enums::payment::PaymentMethod;
use core_domain::ids::{FloorTableId, LocationId, OrderId};
use core_domain::models::{Order, OrderLineItem, PaymentEntry};
use core_domain::ports::{OrderFilter, OrderRepository, PortError};
use core_domain::value_objects::money::Money;
use rusqlite::{params, OptionalExtension};
use std::fmt::Write as _;
use std::path::PathBuf;

type OrderRow = (
    String,
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    String,
    String,
    String,
    Option<String>,
);

const ACTIVE_STATUSES: [&str; 5] = [
    "\"Draft\"",
    "\"Confirmed\"",
    "\"Preparing\"",
    "\"Ready\"",
    "\"Served\"",
];

/// Comma list of active statuses as single-quoted SQL string literals.
/// (Double quotes would parse as identifiers and match nothing.)
fn active_status_list() -> String {
    ACTIVE_STATUSES
        .iter()
        .map(|s| format!("'{s}'"))
        .collect::<Vec<_>>()
        .join(",")
}

#[derive(Debug, Clone)]
pub struct SqliteOrderRepository {
    store: Store,
}

impl SqliteOrderRepository {
    #[must_use]
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            store: Store::new(db_path),
        }
    }

    fn save_blocking(&self, order: &Order) -> Result<(), PortError> {
        let mut conn = self.store.conn()?;
        let tx = conn
            .transaction()
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        tx.execute(
            "INSERT INTO orders (id, tenant_id, location_id, terminal_id, channel, status, table_id, seat_number, subtotal_minor, discount_minor, tax_minor, total_minor, created_by, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, 0, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET status = excluded.status, table_id = excluded.table_id,
                 seat_number = excluded.seat_number, total_minor = excluded.total_minor, updated_at = excluded.updated_at,
                 deleted_at = excluded.deleted_at",
            params![
                order.id.to_string(),
                order.tenant_id.to_string(),
                order.location_id.to_string(),
                order.terminal_id.to_string(),
                to_json(&order.channel)?,
                to_json(&order.status)?,
                order.table_id.map(|t| t.to_string()),
                order.seat_number.map(|s| to_json(&s)).transpose()?,
                order.payments.iter().map(|p| p.amount.to_minor_units()).sum::<i64>(),
                order.created_by.to_string(),
                order.created_at.to_rfc3339(),
                order.updated_at.to_rfc3339(),
                order.deleted_at.map(|d| d.to_rfc3339()),
            ],
        )
        .map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        tx.execute(
            "DELETE FROM order_line_items WHERE order_id = ?1",
            params![order.id.to_string()],
        )
        .map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        tx.execute(
            "DELETE FROM order_payments WHERE order_id = ?1",
            params![order.id.to_string()],
        )
        .map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        for item in &order.items {
            tx.execute(
                "INSERT INTO order_line_items (id, tenant_id, location_id, order_id, menu_item_id, name, unit_price_minor, quantity, fired_quantity, tax_rate, notes, seat_number)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    item.id.to_string(),
                    order.tenant_id.to_string(),
                    order.location_id.to_string(),
                    order.id.to_string(),
                    item.menu_item_id.to_string(),
                    item.name,
                    item.unit_price.to_minor_units(),
                    item.quantity,
                    item.fired_quantity,
                    to_json(&item.tax_rate)?,
                    item.notes,
                    item.seat_number.map(|s| to_json(&s)).transpose()?,
                ],
            )
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        }
        for payment in &order.payments {
            tx.execute(
                "INSERT INTO order_payments (id, tenant_id, location_id, order_id, method, amount_minor, status, reference, recorded_by, recorded_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    uuid::Uuid::now_v7().to_string(),
                    order.tenant_id.to_string(),
                    order.location_id.to_string(),
                    order.id.to_string(),
                    to_json(&payment.method)?,
                    payment.amount.to_minor_units(),
                    to_json(&payment.status)?,
                    payment.reference,
                    payment.recorded_by.to_string(),
                    payment.recorded_at.to_rfc3339(),
                ],
            )
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        }
        tx.commit().map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        Ok(())
    }

    fn load_items(
        &self,
        order_id: &str,
        tenant: &str,
        location: &str,
    ) -> Result<Vec<OrderLineItem>, PortError> {
        let conn = self.store.conn()?;
        let mut stmt = conn
            .prepare("SELECT id, menu_item_id, name, unit_price_minor, quantity, fired_quantity, tax_rate, notes, seat_number FROM order_line_items WHERE order_id = ?1 ORDER BY name")
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let rows = stmt
            .query_map(params![order_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                ))
            })
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let mut items = Vec::new();
        for row in rows {
            let (id, menu_item_id, name, unit_minor, qty, fired, tax, notes, seat) =
                row.map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let unit = minor(unit_minor);
            items.push(OrderLineItem {
                id: id_from_text(&id)?,
                menu_item_id: id_from_text(&menu_item_id)?,
                name,
                base_price: unit.clone(),
                modifier_selections: Vec::new(),
                modifier_total: Money::zero(unit.currency),
                unit_price: unit,
                quantity: u32::try_from(qty).unwrap_or(u32::MAX),
                fired_quantity: u32::try_from(fired).unwrap_or(u32::MAX),
                tax_rate: from_json(&tax)?,
                notes,
                seat_number: seat.map(|s| from_json(&s)).transpose()?,
            });
        }
        let _ = (tenant, location);
        Ok(items)
    }

    fn load_payments(&self, order_id: &str) -> Result<Vec<PaymentEntry>, PortError> {
        let conn = self.store.conn()?;
        let mut stmt = conn
            .prepare("SELECT method, amount_minor, status, reference, recorded_by, recorded_at FROM order_payments WHERE order_id = ?1 ORDER BY recorded_at")
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let rows = stmt
            .query_map(params![order_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let mut out = Vec::new();
        for row in rows {
            let (method, minor_amount, status, reference, by, at) =
                row.map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let method: PaymentMethod = from_json(&method)?;
            out.push(PaymentEntry {
                method,
                amount: minor(minor_amount),
                reference,
                status: from_json(&status)?,
                recorded_at: time_from_text(&at)?,
                recorded_by: id_from_text(&by)?,
            });
        }
        Ok(out)
    }

    fn read_order(&self, id: &str) -> Result<Option<Order>, PortError> {
        let conn = self.store.conn()?;
        let row: Option<OrderRow> = conn
            .query_row(
                "SELECT id, tenant_id, location_id, terminal_id, channel, status, table_id, seat_number, created_by, created_at, updated_at, deleted_at FROM orders WHERE id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                        row.get(8)?,
                        row.get(9)?,
                        row.get(10)?,
                        row.get(11)?,
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
            terminal,
            channel,
            status,
            table,
            seat,
            by,
            created,
            updated,
            deleted,
        )) = row
        else {
            return Ok(None);
        };
        Ok(Some(Order {
            id: id_from_text(&id)?,
            tenant_id: id_from_text(&tenant)?,
            location_id: id_from_text(&location)?,
            terminal_id: id_from_text(&terminal)?,
            channel: from_json(&channel)?,
            status: from_json(&status)?,
            table_id: table
                .map(|t| id_from_text::<FloorTableId>(&t))
                .transpose()?,
            seat_number: seat.map(|s| from_json(&s)).transpose()?,
            items: self.load_items(&id, &tenant, &location)?,
            discounts: Vec::new(),
            charges: Vec::new(),
            tip: None,
            payments: self.load_payments(&id)?,
            split_from: None,
            created_by: id_from_text(&by)?,
            created_at: time_from_text(&created)?,
            updated_at: time_from_text(&updated)?,
            deleted_at: opt_time_from_text(deleted)?,
        }))
    }
}

impl OrderRepository for SqliteOrderRepository {
    fn save(
        &self,
        order: &Order,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        std::future::ready(self.save_blocking(order))
    }

    fn find_by_id(
        &self,
        id: OrderId,
    ) -> impl std::future::Future<Output = Result<Option<Order>, PortError>> + Send {
        std::future::ready(self.read_order(&id.to_string()))
    }

    fn find_active_by_table(
        &self,
        location_id: LocationId,
        table_id: FloorTableId,
    ) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
        let result = (|| -> Result<Vec<Order>, PortError> {
            let conn = self.store.conn()?;
            let placeholders = active_status_list();
            let mut stmt = conn
                .prepare(&format!("SELECT id FROM orders WHERE location_id = ?1 AND table_id = ?2 AND status IN ({placeholders}) AND deleted_at IS NULL"))
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let ids: Vec<String> = stmt
                .query_map(
                    params![location_id.to_string(), table_id.to_string()],
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
                if let Some(order) = self.read_order(id)? {
                    out.push(order);
                }
            }
            Ok(out)
        })();
        std::future::ready(result)
    }

    fn find_by_shift(
        &self,
        _shift_id: core_domain::ids::ShiftId,
    ) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
        // ponytail: no shift column until migration 6; empty until then.
        std::future::ready(Ok(Vec::new()))
    }

    fn query(
        &self,
        filter: &OrderFilter,
    ) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
        let result = (|| -> Result<Vec<Order>, PortError> {
            let conn = self.store.conn()?;
            let mut sql = "SELECT id FROM orders WHERE deleted_at IS NULL".to_string();
            let mut args: Vec<String> = Vec::new();
            if let Some(t) = filter.tenant_id {
                sql.push_str(" AND tenant_id = ?");
                args.push(t.to_string());
            }
            if let Some(l) = filter.location_id {
                sql.push_str(" AND location_id = ?");
                args.push(l.to_string());
            }
            if let Some(t) = filter.table_id {
                sql.push_str(" AND table_id = ?");
                args.push(t.to_string());
            }
            if let Some(s) = filter.status {
                sql.push_str(" AND status = ?");
                args.push(to_json(&s)?);
            }
            sql.push_str(" ORDER BY created_at DESC");
            if let Some(limit) = filter.limit {
                let _ = write!(sql, " LIMIT {limit}");
                if let Some(offset) = filter.offset {
                    let _ = write!(sql, " OFFSET {offset}");
                }
            }
            let mut stmt = conn
                .prepare(&sql)
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let params: Vec<&dyn rusqlite::ToSql> =
                args.iter().map(|a| a as &dyn rusqlite::ToSql).collect();
            let ids: Vec<String> = stmt
                .query_map(params.as_slice(), |row| row.get(0))
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?
                .collect::<Result<_, _>>()
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let mut out = Vec::new();
            for id in &ids {
                if let Some(order) = self.read_order(id)? {
                    out.push(order);
                }
            }
            Ok(out)
        })();
        std::future::ready(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repos::tests::{cleanup, migrated_file_db};
    use core_domain::enums::order_channel::OrderChannel;
    use core_domain::enums::order_status::OrderStatus;
    use core_domain::ids::{
        LocationId, MenuItemId, OrderLineItemId, StaffMemberId, TenantId, TerminalId,
    };
    use core_domain::models::Order;
    use core_domain::value_objects::money::{Currency, Money};
    use core_domain::value_objects::tax::GstRate;
    use rust_decimal::Decimal;

    fn sample_order() -> Order {
        let (mut order, _) = Order::new(
            TenantId::new(),
            LocationId::new(),
            TerminalId::new(),
            OrderChannel::DineIn,
            StaffMemberId::new(),
            None,
            None,
        );
        let price = Money {
            amount: Decimal::new(320, 0),
            currency: Currency::Inr,
        };
        order
            .add_item(OrderLineItem {
                id: OrderLineItemId::new(),
                menu_item_id: MenuItemId::new(),
                name: "Paneer Tikka".to_string(),
                base_price: price.clone(),
                modifier_selections: Vec::new(),
                modifier_total: Money::zero(Currency::Inr),
                unit_price: price,
                quantity: 2,
                fired_quantity: 0,
                tax_rate: GstRate::FivePercent,
                notes: None,
                seat_number: None,
            })
            .expect("add item");
        order
    }

    #[tokio::test]
    async fn round_trip_preserves_persisted_fields() {
        let (_conn, path) = migrated_file_db("order-rt");
        let repo = SqliteOrderRepository::new(path.clone());
        let order = sample_order();
        repo.save(&order).await.expect("save");
        let back = repo
            .find_by_id(order.id)
            .await
            .expect("find")
            .expect("present");
        assert_eq!(back.id, order.id);
        assert_eq!(back.status, OrderStatus::Draft);
        assert_eq!(back.items.len(), 1);
        assert_eq!(back.items[0].line_total(), order.items[0].line_total());
        assert!(back.discounts.is_empty());
        cleanup(&path);
    }

    #[tokio::test]
    async fn missing_order_returns_none() {
        let (_conn, path) = migrated_file_db("order-miss");
        let repo = SqliteOrderRepository::new(path.clone());
        assert!(repo
            .find_by_id(OrderId::new())
            .await
            .expect("find")
            .is_none());
        cleanup(&path);
    }

    #[tokio::test]
    async fn query_filters_by_status() {
        let (_conn, path) = migrated_file_db("order-q");
        let repo = SqliteOrderRepository::new(path.clone());
        let order = sample_order();
        repo.save(&order).await.expect("save");
        let found = repo
            .query(&OrderFilter {
                tenant_id: Some(order.tenant_id),
                status: Some(OrderStatus::Draft),
                ..Default::default()
            })
            .await
            .expect("query");
        assert_eq!(found.len(), 1);
        let settled = repo
            .query(&OrderFilter {
                tenant_id: Some(order.tenant_id),
                status: Some(OrderStatus::Settled),
                ..Default::default()
            })
            .await
            .expect("query");
        assert!(settled.is_empty());
        cleanup(&path);
    }
}
