#![forbid(unsafe_code)]

//! Append-only SQLite [`AuditRepository`] over `audit_events`. No UPDATE or
//! DELETE API exists by design; immutability is structural, not conventional.

use super::{Store, id_from_text, time_from_text};
use core_domain::ids::{LocationId, TenantId};
use core_domain::models::AuditEvent;
use core_domain::ports::{AuditRepository, PortError};
use rusqlite::params;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct SqliteAuditRepository {
    store: Store,
}

impl SqliteAuditRepository {
    #[must_use]
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            store: Store::new(db_path),
        }
    }
}

impl AuditRepository for SqliteAuditRepository {
    fn append(&self, event: &AuditEvent) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
        let result = (|| -> Result<(), PortError> {
            let conn = self.store.conn()?;
            conn.execute(
                "INSERT INTO audit_events (id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    event.id.to_string(),
                    event.tenant_id.to_string(),
                    event.location_id.to_string(),
                    event.actor_id.to_string(),
                    event.action,
                    event.target_type,
                    event.target_id,
                    event.payload_json,
                    i64::from(event.is_anomaly),
                    event.timestamp.to_rfc3339(),
                ],
            )
            .map_err(|e| PortError::StorageUnavailable {
                reason: e.to_string(),
            })?;
            Ok(())
        })();
        std::future::ready(result)
    }

    fn query(
        &self,
        tenant_id: TenantId,
        location_id: LocationId,
        limit: usize,
    ) -> impl std::future::Future<Output = Result<Vec<AuditEvent>, PortError>> + Send {
        let result = (|| -> Result<Vec<AuditEvent>, PortError> {
            let conn = self.store.conn()?;
            let mut stmt = conn
                .prepare(&format!("SELECT id, tenant_id, location_id, actor_id, action, target_type, target_id, payload_json, is_anomaly, timestamp FROM audit_events WHERE tenant_id = ?1 AND location_id = ?2 ORDER BY timestamp DESC LIMIT {limit}"))
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let rows = stmt
                .query_map(params![tenant_id.to_string(), location_id.to_string()], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, Option<String>>(7)?,
                        row.get::<_, i64>(8)?,
                        row.get::<_, String>(9)?,
                    ))
                })
                .map_err(|e| PortError::StorageUnavailable {
                    reason: e.to_string(),
                })?;
            let mut out = Vec::new();
            for row in rows {
                let (id, tenant, location, actor, action, target_type, target_id, payload, anomaly, ts) =
                    row.map_err(|e| PortError::StorageUnavailable {
                        reason: e.to_string(),
                    })?;
                out.push(AuditEvent {
                    id: id_from_text(&id)?,
                    tenant_id: id_from_text(&tenant)?,
                    location_id: id_from_text(&location)?,
                    actor_id: id_from_text(&actor)?,
                    action,
                    target_type,
                    target_id,
                    payload_json: payload,
                    is_anomaly: anomaly != 0,
                    timestamp: time_from_text(&ts)?,
                });
            }
            Ok(out)
        })();
        std::future::ready(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repos::tests::{cleanup, migrated_file_db};
    use core_domain::ids::{LocationId, StaffMemberId, TenantId};

    #[tokio::test]
    async fn append_then_query_newest_first() {
        let (_conn, path) = migrated_file_db("audit-rt");
        let repo = SqliteAuditRepository::new(path.clone());
        let tenant = TenantId::new();
        let location = LocationId::new();
        for action in ["ORDER_VOID", "PRICE_OVERRIDE"] {
            repo.append(&AuditEvent::new(
                tenant,
                location,
                StaffMemberId::new(),
                action.to_string(),
                "Order".to_string(),
                "order-1".to_string(),
                None,
                false,
            ))
            .await
            .expect("append");
        }
        let events = repo.query(tenant, location, 10).await.expect("query");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].action, "PRICE_OVERRIDE");
        cleanup(&path);
    }

    #[tokio::test]
    async fn duplicate_append_is_rejected() {
        let (_conn, path) = migrated_file_db("audit-dup");
        let repo = SqliteAuditRepository::new(path.clone());
        let event = AuditEvent::new(
            TenantId::new(),
            LocationId::new(),
            StaffMemberId::new(),
            "LOGIN".to_string(),
            "Staff".to_string(),
            "staff-1".to_string(),
            None,
            false,
        );
        repo.append(&event).await.expect("first append");
        assert!(repo.append(&event).await.is_err(), "duplicate id must fail");
        cleanup(&path);
    }
}
