#![forbid(unsafe_code)]

//! Inbound mutation applier: remote [`MutationRecord`]s into local SQLite.
//!
//! Transport-agnostic: the caller fetches mutations (WebSocket, poll) and
//! hands each record here. Fidelity ceiling: order discounts, charges, tips,
//! and non-persisted rich fields follow the repository ceiling (totals
//! round-trip; breakdowns may not). Status changes validate against the
//! domain state machine before writing.

use super::super::repos::{SqliteKitchenTicketRepository, SqliteMenuRepository, SqliteOrderRepository};
use core_domain::enums::order_status::OrderStatus;
use core_domain::ids::{FloorTableId, LocationId, OrderId, StaffMemberId, TenantId};
use core_domain::models::Order;
use core_domain::ports::{KitchenTicketRepository, MenuRepository, OrderRepository, PortError};
use core_domain::value_objects::discount::{Discount, DiscountReason, DiscountType};
use core_domain::value_objects::table::SeatNumber;
use rust_decimal::Decimal;
use std::path::Path;
use sync_protocol::mutation::{MutationPayload, MutationRecord};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum ApplyError {
    #[error("Storage error: {0}")]
    Storage(#[from] PortError),
    #[error("Bad payload: {0}")]
    BadPayload(String),
    #[error("Missing actor for void")]
    MissingActor,
    #[error("Order not found: {0}")]
    OrderNotFound(OrderId),
    #[error("Ticket not found: {0}")]
    TicketNotFound(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApplyOutcome {
    Applied,
    SkippedUnsupported,
    SkippedUnknown,
}

pub struct LocalStores {
    pub orders: SqliteOrderRepository,
    pub tickets: SqliteKitchenTicketRepository,
    pub menu: SqliteMenuRepository,
}

impl LocalStores {
    #[must_use]
    pub fn open(db_path: &Path) -> Self {
        Self {
            orders: SqliteOrderRepository::new(db_path.to_path_buf()),
            tickets: SqliteKitchenTicketRepository::new(db_path.to_path_buf()),
            menu: SqliteMenuRepository::new(db_path.to_path_buf()),
        }
    }
}

fn parse_status(text: &str) -> Result<OrderStatus, ApplyError> {
    serde_json::from_str::<OrderStatus>(&format!("\"{text}\""))
        .map_err(|_| ApplyError::BadPayload(format!("unknown order status {text}")))
}

fn parse_channel(text: &str) -> Result<core_domain::enums::order_channel::OrderChannel, ApplyError> {
    serde_json::from_str(&format!("\"{text}\""))
        .map_err(|_| ApplyError::BadPayload(format!("unknown channel {text}")))
}

/// Applies one inbound mutation to local SQLite.
///
/// # Errors
/// Returns [`ApplyError`] when the payload is malformed or storage fails.
pub async fn apply_mutation(stores: &LocalStores, record: &MutationRecord) -> Result<ApplyOutcome, ApplyError> {
    let payload: MutationPayload = serde_json::from_str(&record.payload_json)
        .map_err(|e| ApplyError::BadPayload(format!("unparsable mutation payload: {e}")))?;
    match &payload {
        MutationPayload::OrderCreated(p) => {
            let (mut order, _) = Order::new(
                TenantId::from(p.tenant_id),
                LocationId::from(p.location_id),
                core_domain::ids::TerminalId::from(Uuid::nil()),
                parse_channel(&p.channel)?,
                StaffMemberId::from(p.created_by),
                p.table_id.map(FloorTableId::from),
                p.seat_number
                    .map(SeatNumber::new)
                    .transpose()
                    .map_err(|_| ApplyError::BadPayload("bad seat number".to_string()))?,
            );
            // Preserve the inbound identity instead of the fresh one.
            order.id = OrderId::from(record.entity_id);
            stores.orders.save(&order).await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::OrderStatusUpdated(p) => {
            let id = OrderId::from(p.order_id);
            let mut order = stores.orders.find_by_id(id).await?.ok_or(ApplyError::OrderNotFound(id))?;
            let target = parse_status(&p.to_status)?;
            if target == OrderStatus::Voided {
                let by = p.updated_by.map(StaffMemberId::from).ok_or(ApplyError::MissingActor)?;
                order
                    .void_order("remote sync void".to_string(), by, false)
                    .map_err(|e| ApplyError::BadPayload(e.to_string()))?;
            } else {
                if !order.status.can_transition_to(&target) {
                    return Err(ApplyError::BadPayload(format!(
                        "illegal transition {:?} -> {target:?}",
                        order.status
                    )));
                }
                order.status = target;
            }
            stores.orders.save(&order).await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::OrderDiscountApplied(p) => {
            let id = OrderId::from(p.order_id);
            let mut order = stores.orders.find_by_id(id).await?.ok_or(ApplyError::OrderNotFound(id))?;
            let discount_type = if let Some(pct) = &p.discount_percent {
                let rate = Decimal::from_str_exact(pct)
                    .map_err(|_| ApplyError::BadPayload(format!("bad percent {pct}")))?;
                DiscountType::Percentage(rate)
            } else if let Some(minor) = p.discount_amount_minor {
                let currency = order
                    .items
                    .first()
                    .map(|i| i.unit_price.currency)
                    .unwrap_or(core_domain::value_objects::money::Currency::Inr);
                DiscountType::FlatAmount(core_domain::value_objects::money::Money::from_minor_units(minor, currency))
            } else {
                return Err(ApplyError::BadPayload("discount needs percent or amount".to_string()));
            };
            order
                .apply_discount(Discount {
                    discount_type,
                    reason: DiscountReason::Custom(p.reason.clone()),
                    authorized_by: p.authorized_by.map(StaffMemberId::from),
                })
                .map_err(|e| ApplyError::BadPayload(e.to_string()))?;
            stores.orders.save(&order).await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::OrderVoided(p) => {
            let id = OrderId::from(p.order_id);
            let mut order = stores.orders.find_by_id(id).await?.ok_or(ApplyError::OrderNotFound(id))?;
            order
                .void_order(p.reason.clone(), StaffMemberId::from(p.voided_by), p.requires_supervisor)
                .map_err(|e| ApplyError::BadPayload(e.to_string()))?;
            stores.orders.save(&order).await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::TicketBumped(p) => {
            let id = core_domain::ids::KitchenTicketId::from(p.ticket_id);
            let mut ticket = stores
                .tickets
                .find_by_id(id)
                .await?
                .ok_or_else(|| ApplyError::TicketNotFound(p.ticket_id.to_string()))?;
            ticket
                .bump(p.bumped_by.map(StaffMemberId::from))
                .map_err(|e| ApplyError::BadPayload(e.to_string()))?;
            stores.tickets.save(&ticket).await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::StockAdjusted(_)
        | MutationPayload::AggregatorOrderIngested(_) => Ok(ApplyOutcome::SkippedUnsupported),
        MutationPayload::MenuItemAvailabilityToggled(p) => {
            stores
                .menu
                .set_availability(core_domain::ids::MenuItemId::from(p.menu_item_id), p.is_available)
                .await?;
            Ok(ApplyOutcome::Applied)
        }
        MutationPayload::Unknown => Ok(ApplyOutcome::SkippedUnknown),
        // #[non_exhaustive] future variants fail safe until mapped.
        _ => Ok(ApplyOutcome::SkippedUnknown),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations::migrate;
    use chrono::Utc;
    use core_domain::enums::order_channel::OrderChannel;
    use core_domain::ids::{MenuCategoryId, MenuItemId, TenantId, TerminalId};
    use core_domain::models::{MenuCategory, MenuItem};
    use core_domain::value_objects::money::{Currency, Money};
    use core_domain::value_objects::pricing::PricingVersion;
    use core_domain::value_objects::tax::GstRate;
    use sync_protocol::mutation::{EntityType, OperationType};

    fn temp_path(tag: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "plinth-inbound-test-{tag}-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        path
    }

    fn migrated_path(tag: &str) -> std::path::PathBuf {
        let path = temp_path(tag);
        let mut conn = rusqlite::Connection::open(&path).expect("open");
        migrate(&mut conn).expect("migrate");
        path
    }

    fn record(payload: MutationPayload) -> MutationRecord {
        MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: EntityType::Order,
            operation: OperationType::Create,
            payload_json: serde_json::to_string(&payload).expect("payload serializes"),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 1,
            checksum: "x".to_string(),
        }
    }

    #[tokio::test]
    async fn creates_then_voids_order() {
        let path = migrated_path("create-void");
        let stores = LocalStores::open(&path);
        let tenant = Uuid::now_v7();
        let location = Uuid::now_v7();
        let staff = Uuid::now_v7();
        let created = sync_protocol::mutation::OrderCreatedPayload {
            order_id: Uuid::now_v7(),
            tenant_id: tenant,
            location_id: location,
            channel: "DineIn".to_string(),
            table_id: None,
            seat_number: None,
            created_by: staff,
            created_at: Utc::now(),
        };
        let mut rec = record(MutationPayload::OrderCreated(created));
        rec.entity_id = rec.mutation_id;
        // Align entity identity: applier keys off record.entity_id.
        let order_id = OrderId::from(rec.entity_id);
        assert_eq!(
            apply_mutation(&stores, &rec).await.expect("apply"),
            ApplyOutcome::Applied
        );
        assert!(stores.orders.find_by_id(order_id).await.expect("find").is_some());

        let voided = sync_protocol::mutation::OrderVoidedPayload {
            order_id: rec.entity_id,
            reason: "walkout".to_string(),
            voided_by: staff,
            requires_supervisor: true,
        };
        let rec2 = MutationRecord { entity_id: rec.entity_id, ..record(MutationPayload::OrderVoided(voided)) };
        assert_eq!(
            apply_mutation(&stores, &rec2).await.expect("void"),
            ApplyOutcome::Applied
        );
        let back = stores.orders.find_by_id(order_id).await.expect("find").expect("present");
        assert_eq!(back.status, OrderStatus::Voided);
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn rejects_illegal_transition_and_unknown() {
        let path = migrated_path("illegal");
        let stores = LocalStores::open(&path);
        let (order, _) = Order::new(
            TenantId::new(),
            LocationId::new(),
            TerminalId::new(),
            OrderChannel::Takeaway,
            StaffMemberId::new(),
            None,
            None,
        );
        stores.orders.save(&order).await.expect("save");
        let bad = MutationRecord {
            entity_id: order.id.into(),
            ..record(MutationPayload::OrderStatusUpdated(
                sync_protocol::mutation::OrderStatusUpdatedPayload {
                    order_id: order.id.into(),
                    from_status: "Draft".to_string(),
                    to_status: "Settled".to_string(),
                    updated_by: None,
                    updated_at: Utc::now(),
                },
            ))
        };
        assert!(apply_mutation(&stores, &bad).await.is_err());
        let unknown = record(MutationPayload::Unknown);
        assert_eq!(
            apply_mutation(&stores, &unknown).await.expect("unknown"),
            ApplyOutcome::SkippedUnknown
        );
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn toggles_menu_availability() {
        let path = migrated_path("avail");
        let stores = LocalStores::open(&path);
        let tenant = TenantId::new();
        let location = LocationId::new();
        let category = MenuCategory::new(MenuCategoryId::new(), tenant, location, "Mains".to_string(), 1);
        stores.menu.save_category(&category).await.expect("category");
        let item = MenuItem::new(
            MenuItemId::new(),
            tenant,
            location,
            category.id,
            "Burger".to_string(),
            PricingVersion {
                price: Money {
                    amount: Decimal::new(200, 0),
                    currency: Currency::Inr,
                },
                effective_from: Utc::now(),
                effective_until: None,
            },
            GstRate::FivePercent,
            true,
            core_domain::enums::kitchen::StationId::Grill,
        );
        stores.menu.save_item(&item).await.expect("item");
        let toggle = MutationRecord {
            ..record(MutationPayload::MenuItemAvailabilityToggled(
                sync_protocol::mutation::MenuItemAvailabilityPayload {
                    menu_item_id: item.id.into(),
                    is_available: false,
                    toggled_by: None,
                },
            ))
        };
        assert_eq!(
            apply_mutation(&stores, &toggle).await.expect("toggle"),
            ApplyOutcome::Applied
        );
        let back = stores.menu.find_item(item.id).await.expect("find").expect("present");
        assert!(!back.is_available);
        let _ = std::fs::remove_file(&path);
    }
}
