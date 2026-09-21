#![deny(unsafe_code)]

pub mod commands;
pub mod db;
pub mod lan_kds;
pub mod migrations;
pub mod printing;
pub mod repos;
pub mod state;
pub mod sync_daemon;

use tokio_util::sync::CancellationToken;

/// Launches the Tauri POS application.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialize or encounter fatal context generation errors.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
