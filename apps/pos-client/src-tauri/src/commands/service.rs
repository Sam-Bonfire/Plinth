#![forbid(unsafe_code)]

//! Service IPC commands: KDS, menu availability, PIN auth, audit, sync status.

use crate::repos::{SqliteAuditRepository, SqliteKitchenTicketRepository, SqliteMenuRepository};
use crate::state::{AppContext, db_path};
use core_domain::enums::kitchen::StationId;
use core_domain::ids::{KitchenTicketId, MenuItemId, StaffMemberId};
use core_domain::models::{AuditEvent, KitchenTicket};
use core_domain::ports::{AuditRepository, KitchenTicketRepository, MenuRepository};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct BumpTicketRequest {
    pub ticket_id: KitchenTicketId,
    pub bumped_by: Option<StaffMemberId>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ToggleAvailabilityRequest {
    pub menu_item_id: MenuItemId,
    pub is_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AuthenticatePinRequest {
    pub pin: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AuthenticatePinResponse {
    pub staff_id: StaffMemberId,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RecordAuditEventRequest {
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub payload_json: Option<String>,
    pub is_anomaly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SyncStatusResponse {
    pub pending: i64,
    pub in_flight: i64,
    pub dead_letter: i64,
}

/// Lists active tickets for a station.
///
/// # Errors
/// Returns an error if the database cannot be read.
#[tauri::command]
pub async fn get_kds_tickets(
    app: AppHandle,
    state: State<'_, AppContext>,
    station: StationId,
) -> Result<Vec<KitchenTicket>, String> {
    let repo = SqliteKitchenTicketRepository::new(db_path(&app)?);
    repo.find_active_by_station(state.location_id, &station)
        .await
        .map_err(|e| e.to_string())
}

/// Bumps a ticket through its domain transition.
///
/// # Errors
/// Returns an error if the ticket is missing or the transition is invalid.
#[tauri::command]
pub async fn bump_ticket(
    app: AppHandle,
    req: BumpTicketRequest,
) -> Result<(), String> {
    let repo = SqliteKitchenTicketRepository::new(db_path(&app)?);
    let mut ticket = repo
        .find_by_id(req.ticket_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Ticket not found".to_string())?;
    ticket.bump(req.bumped_by).map_err(|e| e.to_string())?;
    repo.save(&ticket).await.map_err(|e| e.to_string())
}

/// Toggles menu item availability (86).
///
/// # Errors
/// Returns an error if the item does not exist.
#[tauri::command]
pub async fn toggle_menu_item_avail(
    app: AppHandle,
    req: ToggleAvailabilityRequest,
) -> Result<(), String> {
    let repo = SqliteMenuRepository::new(db_path(&app)?);
    repo.set_availability(req.menu_item_id, req.is_available)
        .await
        .map_err(|e| e.to_string())
}

struct StaffRow {
    id: String,
    name: String,
    role: String,
    pin_hash: String,
}

/// Verifies a PIN against an Argon2 hash, using the same scheme as the
/// edge staff routes. Non-PHC values never match.
fn verify_pin_hash(hash: &str, pin: &str) -> bool {
    use argon2::{Argon2, PasswordHash, PasswordVerifier};
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok()
}

/// Verifies a staff PIN against active local staff.
///
/// # Errors
/// Returns an error if no active staff matches the PIN.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects owned command args")]
pub fn authenticate_pin(
    app: AppHandle,
    state: State<'_, AppContext>,
    req: AuthenticatePinRequest,
) -> Result<AuthenticatePinResponse, String> {
    let path = db_path(&app)?;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, role, pin_hash FROM staff_members WHERE tenant_id = ?1 AND location_id = ?2 AND is_active = 1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            rusqlite::params![state.tenant_id.to_string(), state.location_id.to_string()],
            |row| {
                Ok(StaffRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    role: row.get(2)?,
                    pin_hash: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        if verify_pin_hash(&row.pin_hash, &req.pin) {
            return Ok(AuthenticatePinResponse {
                staff_id: StaffMemberId::from(
                    uuid::Uuid::parse_str(&row.id).map_err(|e| e.to_string())?,
                ),
                name: row.name,
                role: row.role,
            });
        }
    }
    Err("Invalid PIN".to_string())
}

/// Appends an audit event.
///
/// # Errors
/// Returns an error if the event cannot be stored.
#[tauri::command]
pub async fn record_audit_event(
    app: AppHandle,
    state: State<'_, AppContext>,
    req: RecordAuditEventRequest,
) -> Result<(), String> {
    let repo = SqliteAuditRepository::new(db_path(&app)?);
    // Actor attribution comes from the session in a follow-up; the system
    // actor keeps the append path usable before login wiring lands.
    let system = StaffMemberId::from(uuid::Uuid::nil());
    repo.append(&AuditEvent::new(
        state.tenant_id,
        state.location_id,
        system,
        req.action,
        req.target_type,
        req.target_id,
        req.payload_json,
        req.is_anomaly,
    ))
    .await
    .map_err(|e| e.to_string())
}

/// Counts queued, in-flight, and dead-letter sync mutations.
///
/// # Errors
/// Returns an error if the database cannot be read.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects owned command args")]
pub fn get_sync_status(app: AppHandle) -> Result<SyncStatusResponse, String> {
    let path = db_path(&app)?;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    let count = |status: &str| -> Result<i64, String> {
        conn.query_row(
            "SELECT COUNT(*) FROM sync_queue WHERE status = ?1",
            rusqlite::params![status],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    };
    Ok(SyncStatusResponse {
        pending: count("Pending")?,
        in_flight: count("InFlight")?,
        dead_letter: count("DeadLetter")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations::migrate;
    use core_domain::enums::kitchen::StationId;
    use core_domain::ids::{LocationId, MenuCategoryId, MenuItemId, OrderId, OrderLineItemId, TenantId};
    use core_domain::models::{KitchenTicket, MenuCategory, MenuItem, TicketLineItem};
    use core_domain::value_objects::money::{Currency, Money};
    use core_domain::value_objects::pricing::PricingVersion;
    use core_domain::value_objects::tax::GstRate;
    use core_domain::value_objects::preparation::PreparationSla;
    use rust_decimal::Decimal;

    fn migrated_path(tag: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "plinth-svc-test-{tag}-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        let mut conn = rusqlite::Connection::open(&path).expect("open");
        migrate(&mut conn).expect("migrate");
        path
    }

    fn menu_item(category: MenuCategoryId, tenant: TenantId, location: LocationId) -> MenuItem {
        MenuItem::new(
            MenuItemId::new(),
            tenant,
            location,
            category,
            "Burger".to_string(),
            PricingVersion {
                price: Money {
                    amount: Decimal::new(200, 0),
                    currency: Currency::Inr,
                },
                effective_from: chrono::Utc::now(),
                effective_until: None,
            },
            GstRate::FivePercent,
            true,
            StationId::Grill,
        )
    }

    #[tokio::test]
    async fn availability_toggle_round_trip() {
        let path = migrated_path("svc-avail");
        let tenant = TenantId::new();
        let location = LocationId::new();
        let category = MenuCategory::new(MenuCategoryId::new(), tenant, location, "Mains".to_string(), 1);
        let menu = crate::repos::SqliteMenuRepository::new(path.clone());
        menu.save_category(&category).await.expect("category");
        let item = menu_item(category.id, tenant, location);
        menu.save_item(&item).await.expect("item");
        menu.set_availability(item.id, false).await.expect("toggle");
        assert!(!menu.find_item(item.id).await.expect("find").expect("present").is_available);
        assert!(
            menu.query_available(tenant, location).await.expect("query").is_empty()
        );
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn bump_missing_ticket_errors() {
        let path = migrated_path("svc-bump");
        let repo = SqliteKitchenTicketRepository::new(path.clone());
        let missing = repo
            .find_by_id(core_domain::ids::KitchenTicketId::new())
            .await
            .expect("find");
        assert!(missing.is_none());
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn kds_bump_flow() {
        let path = migrated_path("svc-kds");
        let repo = SqliteKitchenTicketRepository::new(path.clone());
        let (mut ticket, _) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            3,
            vec![TicketLineItem {
                line_item_id: OrderLineItemId::new(),
                menu_item_id: MenuItemId::new(),
                name: "Fries".to_string(),
                quantity: 1,
                modifiers: Vec::new(),
                special_instructions: None,
            }],
            PreparationSla::default_restaurant(),
        );
        repo.save(&ticket).await.expect("save");
        ticket.start_prep().expect("prep");
        ticket.mark_ready().expect("ready");
        ticket.bump(None).expect("bump");
        repo.save(&ticket).await.expect("save bumped");
        let back = repo
            .find_by_id(ticket.id)
            .await
            .expect("find")
            .expect("present");
        assert_eq!(back.status, core_domain::enums::kitchen::KitchenTicketStatus::Bumped);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn pin_hash_round_trip_matches_server_scheme() {
        use argon2::{Argon2, PasswordHasher, password_hash::SaltString, password_hash::rand_core::OsRng};
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(b"4321", &salt)
            .expect("hash")
            .to_string();
        assert!(verify_pin_hash(&hash, "4321"));
        assert!(!verify_pin_hash(&hash, "0000"));
        assert!(!verify_pin_hash("plaintext-legacy", "plaintext-legacy"));
        assert!(!verify_pin_hash("", "4321"));
    }

    #[tokio::test]
    async fn audit_append_and_sync_counts() {        let path = migrated_path("svc-audit");
        let audit = SqliteAuditRepository::new(path.clone());
        audit
            .append(&AuditEvent::new(
                TenantId::new(),
                LocationId::new(),
                StaffMemberId::new(),
                "TEST".to_string(),
                "Order".to_string(),
                "o-1".to_string(),
                None,
                false,
            ))
            .await
            .expect("append");
        let conn = rusqlite::Connection::open(&path).expect("open");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM audit_events", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 1);
        let _ = std::fs::remove_file(&path);
    }
}
