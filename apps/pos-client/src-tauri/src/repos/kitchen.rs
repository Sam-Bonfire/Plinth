#![forbid(unsafe_code)]

//! `SQLite` [`KitchenTicketRepository`] over `kitchen_tickets` and
//! `ticket_line_items`.

use super::{from_json, id_from_text, opt_time_from_text, time_from_text, to_json, Store};
use core_domain::enums::kitchen::StationId;
use core_domain::ids::{KitchenTicketId, LocationId, OrderId};
use core_domain::models::{KitchenTicket, TicketLineItem};
use core_domain::ports::{KitchenTicketRepository, PortError, TicketFilter};
use core_domain::value_objects::modifier::ModifierSelection;
use core_domain::value_objects::preparation::PreparationSla;
use rusqlite::{params, OptionalExtension};
use std::fmt::Write as _;
use std::path::PathBuf;
use std::time::Duration;

type TicketRow = (
    String,
    String,
    String,
    String,
    String,
    i64,
    String,
    i64,
    i64,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

#[derive(Debug, Clone)]
pub struct SqliteKitchenTicketRepository {
    store: Store,
}

impl SqliteKitchenTicketRepository {
    #[must_use]
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            store: Store::new(db_path),
        }
    }

    fn save_blocking(&self, ticket: &KitchenTicket) -> Result<(), PortError> {
        let mut conn = self.store.conn()?;
        let tx = conn
            .transaction()
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        tx.execute(
            "INSERT INTO kitchen_tickets (id, order_id, tenant_id, location_id, station, kot_number, status, sla_warning_sec, sla_late_sec, created_at, bumped_at, bumped_by, cancelled_at, cancellation_reason)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
             ON CONFLICT(id) DO UPDATE SET status = excluded.status, bumped_at = excluded.bumped_at,
                 bumped_by = excluded.bumped_by, cancelled_at = excluded.cancelled_at,
                 cancellation_reason = excluded.cancellation_reason",
            params![
                ticket.id.to_string(),
                ticket.order_id.to_string(),
                ticket.tenant_id.to_string(),
                ticket.location_id.to_string(),
                to_json(&ticket.station)?,
                ticket.kot_number,
                to_json(&ticket.status)?,
                ticket.sla.threshold_warning.as_secs().cast_signed(),
                ticket.sla.threshold_late.as_secs().cast_signed(),
                ticket.created_at.to_rfc3339(),
                ticket.bumped_at.map(|d| d.to_rfc3339()),
                ticket.bumped_by.map(|b| b.to_string()),
                ticket.cancelled_at.map(|d| d.to_rfc3339()),
                ticket.cancellation_reason,
            ],
        )
        .map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        tx.execute(
            "DELETE FROM ticket_line_items WHERE ticket_id = ?1",
            params![ticket.id.to_string()],
        )
        .map_err(|e| PortError::StorageUnavailable {
            reason: e.to_string(),
        })?;
        for item in &ticket.items {
            tx.execute(
                "INSERT INTO ticket_line_items (id, tenant_id, location_id, ticket_id, line_item_id, menu_item_id, name, quantity, modifiers_json, special_instructions)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    uuid::Uuid::now_v7().to_string(),
                    ticket.tenant_id.to_string(),
                    ticket.location_id.to_string(),
                    ticket.id.to_string(),
                    item.line_item_id.to_string(),
                    item.menu_item_id.to_string(),
                    item.name,
                    item.quantity,
                    to_json(&item.modifiers)?,
                    item.special_instructions,
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

    fn load_items(&self, ticket_id: &str) -> Result<Vec<TicketLineItem>, PortError> {
        let conn = self.store.conn()?;
        let mut stmt = conn
            .prepare("SELECT line_item_id, menu_item_id, name, quantity, modifiers_json, special_instructions FROM ticket_line_items WHERE ticket_id = ?1 ORDER BY name")
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let rows = stmt
            .query_map(params![ticket_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let mut out = Vec::new();
        for row in rows {
            let (line_id, menu_id, name, qty, mods, notes) =
                row.map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            out.push(TicketLineItem {
                line_item_id: id_from_text(&line_id)?,
                menu_item_id: id_from_text(&menu_id)?,
                name,
                quantity: u32::try_from(qty).unwrap_or(u32::MAX),
                modifiers: mods
                    .map(|m| from_json::<Vec<ModifierSelection>>(&m))
                    .transpose()?
                    .unwrap_or_default(),
                special_instructions: notes,
            });
        }
        Ok(out)
    }

    #[allow(clippy::too_many_lines)]
    fn read_ticket(&self, id: &str) -> Result<Option<KitchenTicket>, PortError> {
        let conn = self.store.conn()?;
        let row: Option<TicketRow> = conn
            .query_row(
                "SELECT id, order_id, tenant_id, location_id, station, kot_number, status, sla_warning_sec, sla_late_sec, created_at, bumped_at, bumped_by, cancelled_at, cancellation_reason FROM kitchen_tickets WHERE id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                        row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?,
                        row.get(8)?, row.get(9)?, row.get(10)?, row.get(11)?,
                        row.get(12)?, row.get(13)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
        let Some((
            id,
            order_id,
            tenant,
            location,
            station,
            kot,
            status,
            warn,
            late,
            created,
            bumped_at,
            bumped_by,
            cancelled_at,
            reason,
        )) = row
        else {
            return Ok(None);
        };
        Ok(Some(KitchenTicket {
            id: id_from_text(&id)?,
            order_id: id_from_text(&order_id)?,
            tenant_id: id_from_text(&tenant)?,
            location_id: id_from_text(&location)?,
            station: from_json(&station)?,
            kot_number: u32::try_from(kot).unwrap_or(u32::MAX),
            items: self.load_items(&id)?,
            status: from_json(&status)?,
            sla: PreparationSla {
                threshold_warning: Duration::from_secs(u64::try_from(warn).unwrap_or(u64::MAX)),
                threshold_late: Duration::from_secs(u64::try_from(late).unwrap_or(u64::MAX)),
            },
            created_at: time_from_text(&created)?,
            bumped_at: opt_time_from_text(bumped_at)?,
            bumped_by: bumped_by.map(|b| id_from_text(&b)).transpose()?,
            cancelled_at: opt_time_from_text(cancelled_at)?,
            cancellation_reason: reason,
        }))
    }

    fn ids_where(&self, where_sql: &str, args: &[String]) -> Result<Vec<KitchenTicket>, PortError> {
        let conn = self.store.conn()?;
        let sql = format!("SELECT id FROM kitchen_tickets WHERE {where_sql}");
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
            if let Some(ticket) = self.read_ticket(id)? {
                out.push(ticket);
            }
        }
        Ok(out)
    }
}

impl KitchenTicketRepository for SqliteKitchenTicketRepository {
    fn save(
        &self,
        ticket: &KitchenTicket,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        std::future::ready(self.save_blocking(ticket))
    }

    fn find_by_id(
        &self,
        id: KitchenTicketId,
    ) -> impl std::future::Future<Output = Result<Option<KitchenTicket>, PortError>> + Send {
        std::future::ready(self.read_ticket(&id.to_string()))
    }

    fn find_active_by_station(
        &self,
        location_id: LocationId,
        station: &StationId,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send {
        let result = (|| -> Result<Vec<KitchenTicket>, PortError> {
            self.ids_where(
                "location_id = ?1 AND station = ?2 AND status IN ('\"Pending\"', '\"InPrep\"')",
                &[location_id.to_string(), to_json(station)?],
            )
        })();
        std::future::ready(result)
    }

    fn find_by_order(
        &self,
        order_id: OrderId,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send {
        std::future::ready(self.ids_where("order_id = ?1", &[order_id.to_string()]))
    }

    fn query(
        &self,
        filter: &TicketFilter,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send {
        let result = (|| -> Result<Vec<KitchenTicket>, PortError> {
            let mut where_sql = "1 = 1".to_string();
            let mut args = Vec::new();
            if let Some(t) = filter.tenant_id {
                where_sql.push_str(" AND tenant_id = ?");
                args.push(t.to_string());
            }
            if let Some(l) = filter.location_id {
                where_sql.push_str(" AND location_id = ?");
                args.push(l.to_string());
            }
            if let Some(ref s) = filter.station {
                where_sql.push_str(" AND station = ?");
                args.push(to_json(s)?);
            }
            if let Some(s) = filter.status {
                where_sql.push_str(" AND status = ?");
                args.push(to_json(&s)?);
            }
            if let Some(o) = filter.order_id {
                where_sql.push_str(" AND order_id = ?");
                args.push(o.to_string());
            }
            if let Some(limit) = filter.limit {
                let _ = write!(where_sql, " ORDER BY created_at DESC LIMIT {limit}");
            }
            self.ids_where(&where_sql, &args)
        })();
        std::future::ready(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repos::tests::{cleanup, migrated_file_db};
    use core_domain::enums::kitchen::StationId;
    use core_domain::ids::{LocationId, MenuItemId, OrderId, OrderLineItemId, TenantId};
    use core_domain::value_objects::preparation::PreparationSla;

    fn sample_ticket() -> KitchenTicket {
        let (ticket, _) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            7,
            vec![TicketLineItem {
                line_item_id: OrderLineItemId::new(),
                menu_item_id: MenuItemId::new(),
                name: "Paneer Tikka".to_string(),
                quantity: 2,
                modifiers: Vec::new(),
                special_instructions: Some("Spicy".to_string()),
            }],
            PreparationSla::default_restaurant(),
        );
        ticket
    }

    #[tokio::test]
    async fn round_trip_preserves_ticket() {
        let (_conn, path) = migrated_file_db("ticket-rt");
        let repo = SqliteKitchenTicketRepository::new(path.clone());
        let ticket = sample_ticket();
        repo.save(&ticket).await.expect("save");
        let back = repo
            .find_by_id(ticket.id)
            .await
            .expect("find")
            .expect("present");
        assert_eq!(back.id, ticket.id);
        assert_eq!(back.kot_number, 7);
        assert_eq!(back.items.len(), 1);
        assert_eq!(back.items[0].name, "Paneer Tikka");
        assert_eq!(back.sla, ticket.sla);
        cleanup(&path);
    }

    #[tokio::test]
    async fn active_by_station_finds_pending() {
        let (_conn, path) = migrated_file_db("ticket-active");
        let repo = SqliteKitchenTicketRepository::new(path.clone());
        let ticket = sample_ticket();
        repo.save(&ticket).await.expect("save");
        let found = repo
            .find_active_by_station(ticket.location_id, &StationId::Grill)
            .await
            .expect("query");
        assert_eq!(found.len(), 1);
        let other = repo
            .find_active_by_station(ticket.location_id, &StationId::Beverages)
            .await
            .expect("query");
        assert!(other.is_empty());
        cleanup(&path);
    }

    #[tokio::test]
    async fn missing_ticket_returns_none() {
        let (_conn, path) = migrated_file_db("ticket-miss");
        let repo = SqliteKitchenTicketRepository::new(path.clone());
        assert!(repo
            .find_by_id(KitchenTicketId::new())
            .await
            .expect("find")
            .is_none());
        cleanup(&path);
    }
}
