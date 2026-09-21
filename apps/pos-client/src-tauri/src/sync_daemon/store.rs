use chrono::{DateTime, Utc};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use sync_protocol::queue::{SyncQueueEntry, SyncQueueError, SyncQueueStore};
use uuid::Uuid;

/// A placeholder SQLite-backed store for the sync queue.
pub struct SqliteSyncQueueStore {
    _conn: Arc<Mutex<Connection>>,
}

impl SqliteSyncQueueStore {
    #[must_use]
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { _conn: conn }
    }
}

#[async_trait::async_trait]
impl SyncQueueStore for SqliteSyncQueueStore {
    async fn enqueue(&self, _entry: SyncQueueEntry) -> Result<(), SyncQueueError> {
        Ok(())
    }

    async fn fetch_pending(&self, _limit: usize, _now: DateTime<Utc>) -> Result<Vec<SyncQueueEntry>, SyncQueueError> {
        Ok(Vec::new())
    }

    async fn mark_in_flight(&self, _mutation_ids: &[Uuid], _updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        Ok(())
    }

    async fn mark_settled(&self, _mutation_ids: &[Uuid], _updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        Ok(())
    }

    async fn mark_failed(&self, _mutation_id: Uuid, _error: String, _next_retry: Option<DateTime<Utc>>, _updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        Ok(())
    }

    async fn quarantine_dead_letter(&self, _mutation_id: Uuid, _reason: String, _updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        Ok(())
    }

    async fn purge_settled_before(&self, _cutoff: DateTime<Utc>) -> Result<usize, SyncQueueError> {
        Ok(0)
    }
}
