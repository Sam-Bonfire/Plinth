use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum EntityType {
    Order,
    Item,
    Payment,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum OperationType {
    Create,
    Update,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MutationRecord {
    pub mutation_id: Uuid,
    pub session_id: Uuid,
    pub entity_id: Uuid,
    pub entity_type: EntityType,
    pub operation: OperationType,
    pub payload_json: String,
    pub timestamp: DateTime<Utc>,
    pub is_urgent: bool,
    pub logical_clock: u64,
    pub checksum: String,
}

impl MutationRecord {
    #[must_use]
    pub fn is_urgent(&self) -> bool {
        self.is_urgent
    }
}
