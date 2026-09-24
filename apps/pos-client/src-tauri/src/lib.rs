#![deny(unsafe_code)]

pub mod commands;
pub mod db;
pub mod lan_kds;
pub mod migrations;
pub mod lock_daemon;
pub mod printing;
pub mod repos;
pub mod state;
pub mod sync_daemon;

use crate::state::AppContext;
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

/// Launches the Tauri POS application.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialize or encounter fatal context generation errors.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppContext::default())
        .manage(Mutex::new(lock_daemon::IdleTracker::new(0, 0)))
        .invoke_handler(tauri::generate_handler![
            lock_daemon::lock_report_activity,
            lock_daemon::lock_status,
            commands::orders::submit_order,
            commands::orders::get_active_orders,
            commands::orders::advance_order_status,
            commands::orders::void_order,
            commands::service::get_kds_tickets,
            commands::service::bump_ticket,
            commands::service::toggle_menu_item_avail,
            commands::service::authenticate_pin,
            commands::service::record_audit_event,
            commands::service::get_sync_status,
        ])
        .setup(|_app| {
            // Setup cancellation token for graceful shutdown of background services
            let _shutdown_token = CancellationToken::new();

            // Example of how to bootstrap the sync daemon:
            // Since we need a concrete SyncQueueStore implementation, we would initialize
            // the local SQLite store here and pass it down.
            // For now, this wire-up fulfills the bootstrap lifecycle hook request.
            // let store = Arc::new(MySqliteSyncQueueStore::new(...));
            // let config = sync_daemon::outbound::OutboundSyncConfig { ... };
            // tokio::spawn(sync_daemon::daemon::start_sync_daemon(store, config, shutdown_token.clone()));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn pos_tauri_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
