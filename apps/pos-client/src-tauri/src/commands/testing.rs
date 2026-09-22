//! IPC integration harness: drives command cores against a migrated temp
//! database with no Tauri runtime.

use super::orders::{
    advance_order_status_impl, get_active_orders_impl, submit_order_impl, void_order_impl,
    AdvanceOrderStatusRequest, SubmitOrderRequest, VoidOrderRequest,
};
use super::service::{get_sync_status_impl, record_audit_event_impl, RecordAuditEventRequest};
use crate::migrations::migrate;
use crate::state::AppContext;
use core_domain::enums::order_channel::OrderChannel;
use core_domain::enums::order_status::OrderStatus;
use core_domain::ids::{FloorTableId, StaffMemberId, TenantId, TerminalId};
use core_domain::models::OrderLineItem;
use core_domain::value_objects::money::{Currency, Money};
use core_domain::value_objects::tax::GstRate;
use rust_decimal::Decimal;

pub fn test_db(tag: &str) -> std::path::PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "plinth-harness-{tag}-{}-{}.db",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    let mut conn = rusqlite::Connection::open(&path).expect("open db");
    crate::db::open_db(&path).expect("open db");
    migrate(&mut conn).expect("migrate");
    path
}

pub fn test_context() -> AppContext {
    AppContext {
        tenant_id: TenantId::new(),
        location_id: core_domain::ids::LocationId::new(),
    }
}

#[tokio::test]
async fn order_lifecycle_flow() {
    let db = test_db("lifecycle");
    let ctx = test_context();
    let staff = StaffMemberId::new();
    let table = FloorTableId::new();

    let price = Money {
        amount: Decimal::new(320, 0),
        currency: Currency::Inr,
    };
    let id = submit_order_impl(
        &db,
        &ctx,
        SubmitOrderRequest {
            tenant_id: ctx.tenant_id,
            location_id: ctx.location_id,
            terminal_id: TerminalId::new(),
            channel: OrderChannel::DineIn,
            created_by: staff,
            table_id: Some(table),
            seat_number: None,
            items: vec![OrderLineItem {
                id: core_domain::ids::OrderLineItemId::new(),
                menu_item_id: core_domain::ids::MenuItemId::new(),
                name: "Burger".to_string(),
                base_price: price.clone(),
                modifier_selections: Vec::new(),
                modifier_total: Money::zero(Currency::Inr),
                unit_price: price,
                quantity: 1,
                fired_quantity: 0,
                tax_rate: GstRate::FivePercent,
                notes: None,
                seat_number: None,
            }],
        },
    )
    .await
    .expect("submit");

    let active = get_active_orders_impl(&db, &ctx, table).await.expect("active");
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].id, id);

    advance_order_status_impl(
        &db,
        &ctx,
        AdvanceOrderStatusRequest {
            order_id: id,
            target_status: OrderStatus::Confirmed,
        },
    )
    .await
    .expect("advance");

    record_audit_event_impl(
        &db,
        &ctx,
        RecordAuditEventRequest {
            action: "ORDER_CONFIRMED".to_string(),
            target_type: "Order".to_string(),
            target_id: id.to_string(),
            payload_json: None,
            is_anomaly: false,
        },
    )
    .await
    .expect("audit");

    void_order_impl(
        &db,
        &ctx,
        VoidOrderRequest {
            order_id: id,
            reason: "test cleanup".to_string(),
            voided_by: staff,
            is_supervisor: true,
        },
    )
    .await
    .expect("void");

    assert!(get_active_orders_impl(&db, &ctx, table).await.expect("active").is_empty());

    let status = get_sync_status_impl(&db).expect("sync status");
    assert_eq!(status.pending, 0);
    let _ = std::fs::remove_file(&db);
}
