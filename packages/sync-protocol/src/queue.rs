use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::mutation::MutationRecord;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SyncQueueStatus {
    /// Queued locally, ready for network dispatch
    Pending,
    /// Dispatched in an active `PushMutations` batch, awaiting `AckMutations`
    InFlight,
    /// Successfully confirmed and persisted by server/peer
    Settled,
    /// Settled with CRDT conflict resolution applied
    ConflictResolved,
    /// Quarantined after exceeding max retries or corruption
    DeadLetter,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SyncQueueEntry {
    /// Unique mutation ID (UUID v7)
    pub mutation_id: Uuid,
    /// Target entity type (e.g. "Order", "`KitchenTicket`")
    pub entity_type: String,
    /// Target entity primary ID
    pub entity_id: String,
    /// The full mutation payload record
    pub mutation: MutationRecord,
    /// Current queue lifecycle status
    pub status: SyncQueueStatus,
    /// Number of dispatch retry attempts
    pub retry_count: u32,
    /// Next scheduled retry timestamp (for exponential backoff)
    pub next_retry_at: Option<DateTime<Utc>>,
    /// Error message if quarantined or failed
    pub last_error: Option<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last status update timestamp
    pub updated_at: DateTime<Utc>,
}

pub const SYNC_QUEUE_SQLITE_DDL: &str = r"
CREATE TABLE IF NOT EXISTS sync_queue (
    mutation_id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    checksum TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry
ON sync_queue (status, next_retry_at);
";


#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub initial_interval_ms: u64, // e.g. 500ms
    pub max_interval_ms: u64,     // e.g. 30_000ms (30s)
    pub multiplier: f64,          // e.g. 2.0
    pub max_retries: u32,         // e.g. 5
}

impl RetryConfig {
    #[must_use]
    pub fn calculate_next_retry(config: &RetryConfig, retry_count: u32, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
        if retry_count >= config.max_retries {
            return None;
        }

        #[allow(clippy::cast_precision_loss, clippy::cast_possible_wrap)]
        let base_interval = (config.initial_interval_ms as f64) * config.multiplier.powi(retry_count as i32);

        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let interval_ms = (base_interval as u64).min(config.max_interval_ms);

        // Add deterministic jitter (e.g. +/- 10%) based on retry_count to avoid thundering herd without needing rand
        // A simple pseudo-randomish jitter based on retry_count:
        // We can vary the jitter between -10% and +10% based on the parity/modulo of retry_count
        // For actual true randomness we would need rand, but deterministic is fine here and easier for testing
        // Let's use a simple deterministic cycle: -10%, +10%, 0%, -5%, +5%
        let jitter_factors = [-0.10, 0.10, 0.0, -0.05, 0.05];
        let jitter_factor = jitter_factors[(retry_count as usize) % jitter_factors.len()];

        #[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]
        let jitter = (interval_ms as f64 * jitter_factor) as i64;

        #[allow(clippy::cast_sign_loss, clippy::cast_possible_wrap)]
        let final_interval_ms = (interval_ms as i64 + jitter).max(0) as u64;

        Some(now + std::time::Duration::from_millis(final_interval_ms))
    }
}

use thiserror::Error;

#[derive(Error, Debug)]
pub enum SyncQueueError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

#[async_trait::async_trait]
pub trait SyncQueueStore: Send + Sync {
    async fn enqueue(&self, entry: SyncQueueEntry) -> Result<(), SyncQueueError>;
    async fn fetch_pending(&self, limit: usize, now: DateTime<Utc>) -> Result<Vec<SyncQueueEntry>, SyncQueueError>;
    async fn mark_in_flight(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError>;
    async fn mark_settled(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError>;
    async fn mark_failed(&self, mutation_id: Uuid, error: String, next_retry: Option<DateTime<Utc>>, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError>;
    async fn quarantine_dead_letter(&self, mutation_id: Uuid, reason: String, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError>;
    async fn purge_settled_before(&self, cutoff: DateTime<Utc>) -> Result<usize, SyncQueueError>;
}

#[cfg(test)]
pub mod test_helpers {
    use super::*;
    use std::sync::Arc;
    use std::sync::Mutex;

    pub struct InMemorySyncQueueStore {
        pub entries: Arc<Mutex<Vec<SyncQueueEntry>>>,
    }

    impl InMemorySyncQueueStore {
        #[must_use]
        pub fn new() -> Self {
            Self {
                entries: Arc::new(Mutex::new(Vec::new())),
            }
        }
    }

    impl Default for InMemorySyncQueueStore {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait::async_trait]
    impl SyncQueueStore for InMemorySyncQueueStore {
        async fn enqueue(&self, entry: SyncQueueEntry) -> Result<(), SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            guard.push(entry);
            Ok(())
        }

        async fn fetch_pending(&self, limit: usize, now: DateTime<Utc>) -> Result<Vec<SyncQueueEntry>, SyncQueueError> {
            let guard = self.entries.lock().unwrap();
            let mut results = Vec::new();
            for entry in guard.iter() {
                if entry.status == SyncQueueStatus::Pending {
                    let ready = match entry.next_retry_at {
                        Some(next_retry) => next_retry <= now,
                        None => true,
                    };
                    if ready {
                        results.push(entry.clone());
                    }
                }
                if results.len() >= limit {
                    break;
                }
            }
            Ok(results)
        }

        async fn mark_in_flight(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            for entry in guard.iter_mut() {
                if mutation_ids.contains(&entry.mutation_id) {
                    entry.status = SyncQueueStatus::InFlight;
                    entry.updated_at = updated_at;
                }
            }
            Ok(())
        }

        async fn mark_settled(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            for entry in guard.iter_mut() {
                if mutation_ids.contains(&entry.mutation_id) {
                    entry.status = SyncQueueStatus::Settled;
                    entry.updated_at = updated_at;
                }
            }
            Ok(())
        }

        async fn mark_failed(&self, mutation_id: Uuid, error: String, next_retry: Option<DateTime<Utc>>, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            if let Some(entry) = guard.iter_mut().find(|e| e.mutation_id == mutation_id) {
                entry.status = SyncQueueStatus::Pending;
                entry.last_error = Some(error);
                entry.next_retry_at = next_retry;
                entry.retry_count += 1;
                entry.updated_at = updated_at;
            }
            Ok(())
        }

        async fn quarantine_dead_letter(&self, mutation_id: Uuid, reason: String, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            if let Some(entry) = guard.iter_mut().find(|e| e.mutation_id == mutation_id) {
                entry.status = SyncQueueStatus::DeadLetter;
                entry.last_error = Some(reason);
                entry.updated_at = updated_at;
            }
            Ok(())
        }

        async fn purge_settled_before(&self, cutoff: DateTime<Utc>) -> Result<usize, SyncQueueError> {
            let mut guard = self.entries.lock().unwrap();
            let initial_len = guard.len();
            guard.retain(|e| !(e.status == SyncQueueStatus::Settled && e.updated_at < cutoff));
            Ok(initial_len - guard.len())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retry_calculation() {
        let config = RetryConfig {
            initial_interval_ms: 500,
            max_interval_ms: 30_000,
            multiplier: 2.0,
            max_retries: 5,
        };

        let now = chrono::Utc::now();

        // Attempt 0: ~500ms (-10% jitter => 450ms)
        let attempt_0 = RetryConfig::calculate_next_retry(&config, 0, now).unwrap();
        let diff_0 = (attempt_0 - now).num_milliseconds();
        assert_eq!(diff_0, 450); // 500 * 2^0 = 500; jitter = -10% -> 450

        // Attempt 1: ~1000ms (+10% jitter => 1100ms)
        let attempt_1 = RetryConfig::calculate_next_retry(&config, 1, now).unwrap();
        let diff_1 = (attempt_1 - now).num_milliseconds();
        assert_eq!(diff_1, 1100); // 500 * 2^1 = 1000; jitter = +10% -> 1100

        // Attempt 2: ~2000ms (0% jitter => 2000ms)
        let attempt_2 = RetryConfig::calculate_next_retry(&config, 2, now).unwrap();
        let diff_2 = (attempt_2 - now).num_milliseconds();
        assert_eq!(diff_2, 2000); // 500 * 2^2 = 2000; jitter = 0% -> 2000

        // Attempt 3: ~4000ms (-5% jitter => 3800ms)
        let attempt_3 = RetryConfig::calculate_next_retry(&config, 3, now).unwrap();
        let diff_3 = (attempt_3 - now).num_milliseconds();
        assert_eq!(diff_3, 3800); // 500 * 2^3 = 4000; jitter = -5% -> 3800

        // Attempt 4: ~8000ms (+5% jitter => 8400ms)
        let attempt_4 = RetryConfig::calculate_next_retry(&config, 4, now).unwrap();
        let diff_4 = (attempt_4 - now).num_milliseconds();
        assert_eq!(diff_4, 8400); // 500 * 2^4 = 8000; jitter = +5% -> 8400

        // Attempt 5: max_retries reached, move to DLQ -> returns None
        let attempt_5 = RetryConfig::calculate_next_retry(&config, 5, now);
        assert!(attempt_5.is_none());
    }

    #[test]
    fn test_retry_calculation_max_interval_capped() {
        let config = RetryConfig {
            initial_interval_ms: 10_000,
            max_interval_ms: 20_000,
            multiplier: 2.0,
            max_retries: 5,
        };

        let now = chrono::Utc::now();

        // Attempt 0: 10_000ms (-10% jitter => 9_000ms)
        let attempt_0 = RetryConfig::calculate_next_retry(&config, 0, now).unwrap();
        assert_eq!((attempt_0 - now).num_milliseconds(), 9_000);

        // Attempt 1: 20_000ms (capped from 20_000ms) (+10% jitter => 22_000ms)
        let attempt_1 = RetryConfig::calculate_next_retry(&config, 1, now).unwrap();
        assert_eq!((attempt_1 - now).num_milliseconds(), 22_000);

        // Attempt 2: 20_000ms (capped from 40_000ms) (0% jitter => 20_000ms)
        let attempt_2 = RetryConfig::calculate_next_retry(&config, 2, now).unwrap();
        assert_eq!((attempt_2 - now).num_milliseconds(), 20_000);
    }

    #[tokio::test]
    async fn test_sync_queue_store_state_transitions() {
        let store = test_helpers::InMemorySyncQueueStore::new();
        let now = chrono::Utc::now();

        let mutation_id_1 = Uuid::now_v7();
        let entry_1 = SyncQueueEntry {
            mutation_id: mutation_id_1,
            entity_type: "Order".to_string(),
            entity_id: "order-1".to_string(),
            mutation: MutationRecord {
                payload_json: "{}".to_string(),
                checksum: "abc".to_string(),
            },
            status: SyncQueueStatus::Pending,
            retry_count: 0,
            next_retry_at: None,
            last_error: None,
            created_at: now,
            updated_at: now,
        };

        let mutation_id_2 = Uuid::now_v7();
        let entry_2 = SyncQueueEntry {
            mutation_id: mutation_id_2,
            entity_type: "Order".to_string(),
            entity_id: "order-2".to_string(),
            mutation: MutationRecord {
                payload_json: "{}".to_string(),
                checksum: "def".to_string(),
            },
            status: SyncQueueStatus::Pending,
            retry_count: 0,
            next_retry_at: None,
            last_error: None,
            created_at: now,
            updated_at: now,
        };

        // Test enqueue
        store.enqueue(entry_1).await.unwrap();
        store.enqueue(entry_2).await.unwrap();

        // Test fetch_pending
        let pending = store.fetch_pending(10, now).await.unwrap();
        assert_eq!(pending.len(), 2);

        // Test mark_in_flight
        store.mark_in_flight(&[mutation_id_1], now).await.unwrap();

        // Fetch pending again, should only return entry 2
        let pending_after_in_flight = store.fetch_pending(10, now).await.unwrap();
        assert_eq!(pending_after_in_flight.len(), 1);
        assert_eq!(pending_after_in_flight[0].mutation_id, mutation_id_2);

        // Test mark_settled
        store.mark_settled(&[mutation_id_1], now).await.unwrap();

        // Test failed retry
        let next_retry = now + std::time::Duration::from_secs(10);
        store.mark_failed(mutation_id_2, "Network error".to_string(), Some(next_retry), now).await.unwrap();

        let pending_after_fail = store.fetch_pending(10, now).await.unwrap();
        // Should be empty because next_retry_at is in the future
        assert_eq!(pending_after_fail.len(), 0);

        // Advance time for fetch_pending to see the failed entry again
        let pending_after_retry = store.fetch_pending(10, next_retry).await.unwrap();
        assert_eq!(pending_after_retry.len(), 1);
        assert_eq!(pending_after_retry[0].retry_count, 1);
        assert_eq!(pending_after_retry[0].last_error.as_deref(), Some("Network error"));

        // Test DLQ quarantine
        store.quarantine_dead_letter(mutation_id_2, "Max retries".to_string(), now).await.unwrap();
        let pending_after_dlq = store.fetch_pending(10, next_retry).await.unwrap();
        assert_eq!(pending_after_dlq.len(), 0);

        // Test purge_settled_before
        // Entry 1 is settled at `now`
        let purged = store.purge_settled_before(now + std::time::Duration::from_secs(1)).await.unwrap();
        assert_eq!(purged, 1);

        // Entry 2 is DLQ, should not be purged
        let guard = store.entries.lock().unwrap();
        assert_eq!(guard.len(), 1);
        assert_eq!(guard[0].mutation_id, mutation_id_2);
        assert_eq!(guard[0].status, SyncQueueStatus::DeadLetter);
    }
}
