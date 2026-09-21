use chrono::Utc;
use reqwest::Client;
use std::sync::Arc;
use sync_protocol::{
    clock::ClientNodeId,
    framing::{BatchPacker, SyncFrame},
    queue::SyncQueueStore,
};
use uuid::Uuid;

/// Configuration for the outbound sync daemon.
#[derive(Debug, Clone)]
pub struct OutboundSyncConfig {
    pub ingest_url: String,
    pub tenant_id: String,
    pub location_id: String,
    pub max_batch_size: usize,
    pub node_id: ClientNodeId,
}

/// Polls the outbound queue, batches pending mutations, and pushes them to the ingest endpoint.
/// Returns the number of mutations processed.
///
/// # Errors
/// Returns an error if queue polling fails or network request encounters a fatal issue.
pub async fn poll_outbound_queue(
    store: &Arc<dyn SyncQueueStore>,
    client: &Client,
    config: &OutboundSyncConfig,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let now = Utc::now();
    let pending_entries = store.fetch_pending(config.max_batch_size, now).await?;

    if pending_entries.is_empty() {
        return Ok(0);
    }

    let mut packer = BatchPacker::new(config.node_id.clone(), config.max_batch_size);
    let mut batch_frames = Vec::new();

    for entry in &pending_entries {
        if let Some(frame) = packer.push(entry.mutation.clone()) {
            batch_frames.push(frame);
        }
    }

    if let Some(frame) = packer.flush() {
        batch_frames.push(frame);
    }

    let mut total_processed = 0;

    for frame in batch_frames {
        if let SyncFrame::PushMutations { mutations, is_urgent: _is_urgent, .. } = &frame {
            let mutation_ids: Vec<Uuid> = mutations.iter().map(|m| m.mutation_id).collect();

            // Mark items in flight before pushing to network
            store.mark_in_flight(&mutation_ids, Utc::now()).await?;

            let response_result = client
                .post(&config.ingest_url)
                .header("x-tenant-id", &config.tenant_id)
                .header("x-location-id", &config.location_id)
                .json(&frame)
                .send()
                .await;

            match response_result {
                Ok(response) => {
                    if response.status().is_success() {
                        // Mark as settled
                        store.mark_settled(&mutation_ids, Utc::now()).await?;
                        total_processed += mutation_ids.len();
                    } else {
                        // Parse error or handle bad status
                        let error_msg = response.text().await.unwrap_or_else(|_| "Unknown HTTP error".to_string());

                        // Fallback failure logic (since all mutations in frame failed)
                        for id in mutation_ids {
                            store.mark_failed(id, error_msg.clone(), Some(Utc::now() + chrono::Duration::seconds(5)), Utc::now()).await?;
                        }
                    }
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    for id in mutation_ids {
                        store.mark_failed(id, error_msg.clone(), Some(Utc::now() + chrono::Duration::seconds(5)), Utc::now()).await?;
                    }
                }
            }
        }
    }

    Ok(total_processed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use reqwest::Client;
    use std::sync::Arc;
    use sync_protocol::{
        clock::ClientNodeId,
        mutation::{EntityType, MutationRecord, OperationType},
        queue::{test_helpers::InMemorySyncQueueStore, SyncQueueEntry, SyncQueueStatus},
    };
    use uuid::Uuid;

    #[tokio::test]
    async fn test_poll_outbound_queue() {
        let store = Arc::new(InMemorySyncQueueStore::new());

        // Use a real HTTP server (mock) to accept the sync request.
        let mut server = mockito::Server::new_async().await;
        let mock_url = server.url();

        let mock_req = server.mock("POST", "/")
            .with_status(200)
            .create_async()
            .await;

        let config = OutboundSyncConfig {
            ingest_url: mock_url.clone(),
            tenant_id: "tenant-1".to_string(),
            location_id: "location-1".to_string(),
            max_batch_size: 50,
            node_id: ClientNodeId("node-1".to_string()),
        };

        let mutation_id = Uuid::now_v7();
        let entry = SyncQueueEntry {
            mutation_id,
            entity_type: "Order".to_string(),
            entity_id: "order-1".to_string(),
            mutation: MutationRecord {
                mutation_id,
                session_id: Uuid::now_v7(),
                entity_id: Uuid::now_v7(),
                entity_type: EntityType::Order,
                operation: OperationType::Create,
                payload_json: "{}".to_string(),
                timestamp: Utc::now(),
                is_urgent: false,
                logical_clock: 1,
                checksum: "test_checksum".to_string(),
            },
            status: SyncQueueStatus::Pending,
            retry_count: 0,
            next_retry_at: None,
            last_error: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Downcast back to push item
        store.enqueue(entry).await.expect("failed to enqueue");

        let client = Client::new();
        let store_dyn = std::sync::Arc::<InMemorySyncQueueStore>::clone(&store) as Arc<dyn SyncQueueStore>;
        let processed = poll_outbound_queue(&store_dyn, &client, &config)
            .await
            .expect("poll failed");

        assert_eq!(processed, 1);
        mock_req.assert_async().await;

        // Check if status is updated to settled
        let guard = store.entries.lock().unwrap();
        assert_eq!(guard.len(), 1);
        assert_eq!(guard[0].status, SyncQueueStatus::Settled);
    }
}
