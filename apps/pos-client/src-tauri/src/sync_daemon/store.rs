use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};
use std::sync::{Arc, Mutex};
use sync_protocol::mutation::MutationRecord;
use sync_protocol::queue::{SyncQueueEntry, SyncQueueError, SyncQueueStatus, SyncQueueStore};
use uuid::Uuid;

fn db_err(e: &rusqlite::Error) -> SyncQueueError {
    SyncQueueError::Database(e.to_string())
}

fn status_name(status: SyncQueueStatus) -> &'static str {
    match status {
        SyncQueueStatus::Pending => "Pending",
        SyncQueueStatus::InFlight => "InFlight",
        SyncQueueStatus::Settled => "Settled",
        SyncQueueStatus::ConflictResolved => "ConflictResolved",
        SyncQueueStatus::DeadLetter => "DeadLetter",
    }
}

fn parse_status(text: &str) -> Result<SyncQueueStatus, SyncQueueError> {
    match text {
        "Pending" => Ok(SyncQueueStatus::Pending),
        "InFlight" => Ok(SyncQueueStatus::InFlight),
        "Settled" => Ok(SyncQueueStatus::Settled),
        "ConflictResolved" => Ok(SyncQueueStatus::ConflictResolved),
        "DeadLetter" => Ok(SyncQueueStatus::DeadLetter),
        other => Err(SyncQueueError::Internal(format!("unknown queue status {other}"))),
    }
}

fn parse_time(text: &str) -> Result<DateTime<Utc>, SyncQueueError> {
    DateTime::parse_from_rfc3339(text)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| SyncQueueError::Internal(format!("bad timestamp {text}: {e}")))
}

struct QueueRow {
    mutation_id: String,
    entity_type: String,
    entity_id: String,
    mutation_json: String,
    status: String,
    retry_count: i64,
    next_retry_at: Option<String>,
    last_error: Option<String>,
    created_at: String,
    updated_at: String,
}

#[allow(clippy::too_many_lines)]
fn read_entry(row: QueueRow) -> Result<SyncQueueEntry, SyncQueueError> {
    let mutation: MutationRecord = serde_json::from_str(&row.mutation_json)
        .map_err(|e| SyncQueueError::Serialization(format!("bad mutation json: {e}")))?;
    Ok(SyncQueueEntry {
        mutation_id: Uuid::parse_str(&row.mutation_id)
            .map_err(|e| SyncQueueError::Internal(format!("bad mutation id: {e}")))?,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        mutation,
        status: parse_status(&row.status)?,
        retry_count: u32::try_from(row.retry_count).unwrap_or(u32::MAX),
        next_retry_at: row.next_retry_at.map(|s| parse_time(&s)).transpose()?,
        last_error: row.last_error,
        created_at: parse_time(&row.created_at)?,
        updated_at: parse_time(&row.updated_at)?,
    })
}

/// SQLite-backed [`SyncQueueStore`] over the `sync_queue` table.
pub struct SqliteSyncQueueStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteSyncQueueStore {
    #[must_use]
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

#[async_trait::async_trait]
impl SyncQueueStore for SqliteSyncQueueStore {
    async fn enqueue(&self, entry: SyncQueueEntry) -> Result<(), SyncQueueError> {
        let mutation_json = serde_json::to_string(&entry.mutation)
            .map_err(|e| SyncQueueError::Serialization(e.to_string()))?;
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        conn.execute(
            "INSERT INTO sync_queue (mutation_id, entity_type, entity_id, payload_json, checksum, status, retry_count, next_retry_at, last_error, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(mutation_id) DO NOTHING",
            params![
                entry.mutation_id.to_string(),
                entry.entity_type,
                entry.entity_id,
                mutation_json,
                entry.mutation.checksum,
                status_name(entry.status),
                i64::from(entry.retry_count),
                entry.next_retry_at.map(|d| d.to_rfc3339()),
                entry.last_error,
                entry.created_at.to_rfc3339(),
                entry.updated_at.to_rfc3339(),
            ],
        )
        .map_err(|e| db_err(&e))?;
        Ok(())
    }

    async fn fetch_pending(&self, limit: usize, now: DateTime<Utc>) -> Result<Vec<SyncQueueEntry>, SyncQueueError> {
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT mutation_id, entity_type, entity_id, payload_json, status, retry_count, next_retry_at, last_error, created_at, updated_at
                 FROM sync_queue WHERE status = 'Pending' AND (next_retry_at IS NULL OR next_retry_at <= ?1)
                 ORDER BY created_at LIMIT {limit}"
            ))
            .map_err(|e| db_err(&e))?;
        let rows = stmt
            .query_map(params![now.to_rfc3339()], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                ))
            })
            .map_err(|e| db_err(&e))?;
        let mut out = Vec::new();
        for row in rows {
            let (id, etype, eid, mjson, status, retries, next, err, created, updated) =
                row.map_err(|e| db_err(&e))?;
            out.push(read_entry(QueueRow {
                mutation_id: id,
                entity_type: etype,
                entity_id: eid,
                mutation_json: mjson,
                status,
                retry_count: retries,
                next_retry_at: next,
                last_error: err,
                created_at: created,
                updated_at: updated,
            })?);
        }
        Ok(out)
    }

    async fn mark_in_flight(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        self.set_status(mutation_ids, SyncQueueStatus::InFlight, updated_at)
    }

    async fn mark_settled(&self, mutation_ids: &[Uuid], updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        self.set_status(mutation_ids, SyncQueueStatus::Settled, updated_at)
    }

    async fn mark_failed(
        &self,
        mutation_id: Uuid,
        error: String,
        next_retry: Option<DateTime<Utc>>,
        updated_at: DateTime<Utc>,
    ) -> Result<(), SyncQueueError> {
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?1, next_retry_at = ?2, updated_at = ?3 WHERE mutation_id = ?4",
            params![
                error,
                next_retry.map(|d| d.to_rfc3339()),
                updated_at.to_rfc3339(),
                mutation_id.to_string(),
            ],
        )
        .map_err(|e| db_err(&e))?;
        Ok(())
    }

    async fn quarantine_dead_letter(&self, mutation_id: Uuid, reason: String, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE sync_queue SET status = 'DeadLetter', last_error = ?1, updated_at = ?2 WHERE mutation_id = ?3",
            params![reason, updated_at.to_rfc3339(), mutation_id.to_string()],
        )
        .map_err(|e| db_err(&e))?;
        Ok(())
    }

    async fn purge_settled_before(&self, cutoff: DateTime<Utc>) -> Result<usize, SyncQueueError> {
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        let count = conn
            .execute(
                "DELETE FROM sync_queue WHERE status = 'Settled' AND updated_at < ?1",
                params![cutoff.to_rfc3339()],
            )
            .map_err(|e| db_err(&e))?;
        Ok(count)
    }
}

impl SqliteSyncQueueStore {
    fn set_status(&self, mutation_ids: &[Uuid], status: SyncQueueStatus, updated_at: DateTime<Utc>) -> Result<(), SyncQueueError> {
        let conn = self.conn.lock().map_err(|e| SyncQueueError::Internal(e.to_string()))?;
        for id in mutation_ids {
            conn.execute(
                "UPDATE sync_queue SET status = ?1, updated_at = ?2 WHERE mutation_id = ?3",
                params![status_name(status), updated_at.to_rfc3339(), id.to_string()],
            )
            .map_err(|e| db_err(&e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sync_protocol::mutation::{EntityType, OperationType};

    fn memory_store() -> SqliteSyncQueueStore {
        let conn = Connection::open_in_memory().expect("memory db");
        conn.execute_batch(sync_protocol::queue::SYNC_QUEUE_SQLITE_DDL)
            .expect("queue ddl");
        SqliteSyncQueueStore::new(Arc::new(Mutex::new(conn)))
    }

    fn sample_entry() -> SyncQueueEntry {
        let now = Utc::now();
        SyncQueueEntry {
            mutation_id: Uuid::now_v7(),
            entity_type: "Order".to_string(),
            entity_id: "order-1".to_string(),
            mutation: MutationRecord {
                mutation_id: Uuid::now_v7(),
                session_id: Uuid::now_v7(),
                entity_id: Uuid::now_v7(),
                entity_type: EntityType::Order,
                operation: OperationType::Create,
                payload_json: "{}".to_string(),
                timestamp: now,
                is_urgent: false,
                logical_clock: 1,
                checksum: "abc".to_string(),
            },
            status: SyncQueueStatus::Pending,
            retry_count: 0,
            next_retry_at: None,
            last_error: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[tokio::test]
    async fn enqueue_fetch_settle_purge_round_trip() {
        let store = memory_store();
        let entry = sample_entry();
        store.enqueue(entry.clone()).await.expect("enqueue");
        // Duplicate enqueue is idempotent.
        store.enqueue(entry.clone()).await.expect("re-enqueue");
        let pending = store.fetch_pending(10, Utc::now()).await.expect("fetch");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].mutation_id, entry.mutation_id);
        assert_eq!(pending[0].mutation.checksum, "abc");
        store
            .mark_in_flight(&[entry.mutation_id], Utc::now())
            .await
            .expect("in flight");
        assert!(store.fetch_pending(10, Utc::now()).await.expect("fetch").is_empty());
        store
            .mark_settled(&[entry.mutation_id], Utc::now())
            .await
            .expect("settled");
        let purged = store
            .purge_settled_before(Utc::now() + chrono::Duration::seconds(1))
            .await
            .expect("purge");
        assert_eq!(purged, 1);
    }

    #[tokio::test]
    async fn failed_then_quarantined() {
        let store = memory_store();
        let entry = sample_entry();
        store.enqueue(entry.clone()).await.expect("enqueue");
        store
            .mark_failed(entry.mutation_id, "timeout".to_string(), None, Utc::now())
            .await
            .expect("failed");
        let pending = store.fetch_pending(10, Utc::now()).await.expect("fetch");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].retry_count, 1);
        store
            .quarantine_dead_letter(entry.mutation_id, "too many retries".to_string(), Utc::now())
            .await
            .expect("quarantine");
        assert!(store.fetch_pending(10, Utc::now()).await.expect("fetch").is_empty());
    }
}
