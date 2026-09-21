use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use sync_protocol::queue::SyncQueueStore;
use tokio_util::sync::CancellationToken;

use crate::sync_daemon::outbound::{poll_outbound_queue, OutboundSyncConfig};

/// Starts the background sync daemon loop.
///
/// This loop periodically polls the local outbound sync queue and attempts to send
/// pending mutations to the cloud edge API.
///
/// # Arguments
/// * `store` - A reference-counted handle to the sync queue storage interface.
/// * `config` - Outbound sync configuration (tenant details, node info, URLs).
/// * `shutdown_token` - Cancellation token used to gracefully terminate the daemon.
pub async fn start_sync_daemon(
    store: Arc<dyn SyncQueueStore>,
    config: OutboundSyncConfig,
    shutdown_token: CancellationToken,
) {
    let client = Client::new();
    // Default polling interval, could be configurable
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    // Tick immediately on start
    interval.tick().await;

    loop {
        tokio::select! {
            () = shutdown_token.cancelled() => {
                println!("Sync daemon received shutdown signal. Terminating gracefully.");
                break;
            }
            _ = interval.tick() => {
                match poll_outbound_queue(&store, &client, &config).await {
                    Ok(processed) => {
                        if processed > 0 {
                            // If we processed items, we can try ticking faster or just log
                            println!("Sync daemon successfully processed {processed} mutations.");
                        }
                    }
                    Err(e) => {
                        eprintln!("Sync daemon encountered error during outbound poll: {e}");
                    }
                }
            }
        }
    }
}
