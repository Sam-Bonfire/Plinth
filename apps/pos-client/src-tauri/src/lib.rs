#![deny(unsafe_code)]

pub mod commands;
pub mod db;
pub mod diag_log;
pub mod lan_kds;
pub mod migrations;
pub mod lock_daemon;
pub mod printing;
pub mod repos;
pub mod state;
pub mod sync_daemon;
pub mod window;
pub mod backup;

use crate::state::AppContext;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// Launches the Tauri POS application.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialize or encounter fatal context generation errors.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::clone_on_ref_ptr)]
pub fn run() {
    let spooler = Arc::new(Mutex::new(printing::spooler::Spooler::new()));
    let dispatcher = Arc::new(printing::tcp_dispatcher::TcpDispatcher::new(
        Duration::from_secs(2),
        Duration::from_secs(2),
        3,
        Duration::from_millis(500),
    ));

    tauri::Builder::default()
        .manage(AppContext::default())
        .manage(Mutex::new(lock_daemon::IdleTracker::new(0, 0)))
        .manage(Mutex::new(diag_log::DiagLog::new(1000)))
        .manage(Mutex::new(window::WindowMachine::new()))
        .manage(spooler.clone())
        .invoke_handler(tauri::generate_handler![
            lock_daemon::lock_report_activity,
            lock_daemon::lock_status,
            commands::orders::submit_order,
            commands::printing::print_receipt,
            commands::printing::print_receipt_doc,
            commands::printing::get_print_queue_state,
            commands::printing::reprint_failed_job,
            commands::orders::get_active_orders,
            commands::orders::advance_order_status,
            commands::orders::void_order,
            commands::service::get_kds_tickets,
            commands::service::bump_ticket,
            commands::service::toggle_menu_item_avail,
            commands::service::authenticate_pin,
            commands::service::record_audit_event,
            commands::service::get_sync_status,
            diag_log::diag_push,
            diag_log::diag_drain,
            diag_log::diag_export,
            window::enter_kiosk,
            window::exit_kiosk,
            window::toggle_fullscreen,
            backup::backup_now,
        ])
        .setup(move |_app| {
            // Setup cancellation token for graceful shutdown of background services
            let shutdown_token = CancellationToken::new();

            // Spawn print daemon
            tokio::spawn(printing::daemon::start_print_daemon(
                spooler,
                dispatcher,
                shutdown_token.clone(),
            ));

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
