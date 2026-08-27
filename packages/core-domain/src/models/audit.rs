use crate::ids::{AuditEventId, LocationId, StaffMemberId, TenantId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Record in the audit log representing terminal events, anomalies, manager overrides, etc.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Audit event ID
    pub id: AuditEventId,
    /// Tenant ID
    pub tenant_id: TenantId,
    /// Location ID
    pub location_id: LocationId,
    /// Staff member ID associated with the action
    pub actor_id: StaffMemberId,
    /// The type of action or event
    pub action: String,
    /// Target entity type (e.g. Order, Shift, `StockItem`)
    pub target_type: String,
    /// Target entity ID
    pub target_id: String,
    /// Detailed JSON payload associated with the event
    pub payload_json: Option<String>,
    /// Whether this event is flagged as an anomaly (e.g., repetitive voids)
    pub is_anomaly: bool,
    /// The time the event occurred
    pub timestamp: DateTime<Utc>,
}

impl AuditEvent {
    /// Creates a new audit event
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        actor_id: StaffMemberId,
        action: String,
        target_type: String,
        target_id: String,
        payload_json: Option<String>,
        is_anomaly: bool,
    ) -> Self {
        Self {
            id: AuditEventId::new(),
            tenant_id,
            location_id,
            actor_id,
            action,
            target_type,
            target_id,
            payload_json,
            is_anomaly,
            timestamp: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_event_creation_and_serde() {
        let event = AuditEvent::new(
            TenantId::new(),
            LocationId::new(),
            StaffMemberId::new(),
            "ORDER_VOID".to_string(),
            "Order".to_string(),
            "ord-123".to_string(),
            Some("{\"reason\":\"Customer left\"}".to_string()),
            true,
        );

        assert!(event.is_anomaly);
        assert_eq!(event.action, "ORDER_VOID");

        let serialized = serde_json::to_string(&event).unwrap();
        let deserialized: AuditEvent = serde_json::from_str(&serialized).unwrap();
        assert_eq!(event, deserialized);
    }
}
