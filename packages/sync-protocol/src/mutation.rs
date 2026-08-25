use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sha2::{Sha256, Digest};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EntityType {
    Order,
    Item,
    Payment,
    KitchenTicket,
    StockItem,
    MenuItem,
    Custom(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperationType {
    Create,
    Update,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderCreatedPayload {
    pub order_id: Uuid,
    pub tenant_id: Uuid,
    pub location_id: Uuid,
    pub channel: String,
    pub table_id: Option<Uuid>,
    pub seat_number: Option<u16>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderStatusUpdatedPayload {
    pub order_id: Uuid,
    pub from_status: String,
    pub to_status: String,
    pub updated_by: Option<Uuid>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderDiscountAppliedPayload {
    pub order_id: Uuid,
    pub discount_percent: Option<String>,
    pub discount_amount_minor: Option<i64>,
    pub reason: String,
    pub authorized_by: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderVoidedPayload {
    pub order_id: Uuid,
    pub reason: String,
    pub voided_by: Uuid,
    pub requires_supervisor: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TicketBumpedPayload {
    pub ticket_id: Uuid,
    pub order_id: Uuid,
    pub station_id: String,
    pub bumped_by: Option<Uuid>,
    pub bumped_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StockAdjustedPayload {
    pub stock_item_id: Uuid,
    pub delta_quantity_str: String,
    pub reason: String,
    pub adjusted_by: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MenuItemAvailabilityPayload {
    pub menu_item_id: Uuid,
    pub is_available: bool,
    pub toggled_by: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AggregatorOrderPayload {
    pub aggregator_order_id: Uuid,
    pub platform: String,
    pub external_id: String,
    pub payload_json: String,
}

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum MutationPayload {
    OrderCreated(OrderCreatedPayload),
    OrderStatusUpdated(OrderStatusUpdatedPayload),
    OrderDiscountApplied(OrderDiscountAppliedPayload),
    OrderVoided(OrderVoidedPayload),
    TicketBumped(TicketBumpedPayload),
    StockAdjusted(StockAdjustedPayload),
    MenuItemAvailabilityToggled(MenuItemAvailabilityPayload),
    AggregatorOrderIngested(AggregatorOrderPayload),
    #[serde(other)]
    Unknown,
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

    #[must_use]
    pub fn compute_checksum(&self) -> String {
        let data = format!(
            "{}:{}:{}:{:?}:{:?}:{}",
            self.mutation_id,
            self.session_id,
            self.entity_id,
            self.entity_type,
            self.operation,
            self.payload_json
        );
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    #[must_use]
    pub fn verify_checksum(&self) -> bool {
        self.compute_checksum() == self.checksum
    }

    /// Serializes the record to a JSON string.
    ///
    /// # Errors
    /// Returns an error if JSON serialization fails.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserializes a record from a JSON string.
    ///
    /// # Errors
    /// Returns an error if JSON deserialization fails.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serializes the record to Bincode binary wire format.
    ///
    /// # Errors
    /// Returns an error if Bincode serialization fails.
    pub fn to_bytes(&self) -> Result<Vec<u8>, bincode::Error> {
        bincode::serialize(self)
    }

    /// Deserializes a record from Bincode binary wire format.
    ///
    /// # Errors
    /// Returns an error if Bincode deserialization fails.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_checksum_verification() {
        let mut record = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: EntityType::Order,
            operation: OperationType::Create,
            payload_json: "{\"order_id\":\"test\"}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 1,
            checksum: String::new(),
        };
        record.checksum = record.compute_checksum();
        assert!(record.verify_checksum());

        // Tamper with payload
        record.payload_json = "{\"order_id\":\"tampered\"}".to_string();
        assert!(!record.verify_checksum());
    }

    #[test]
    fn test_serialization_roundtrip_json() {
        let mut record = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: EntityType::Order,
            operation: OperationType::Update,
            payload_json: "{\"status\":\"Ready\"}".to_string(),
            timestamp: Utc::now(),
            is_urgent: true,
            logical_clock: 42,
            checksum: String::new(),
        };
        record.checksum = record.compute_checksum();

        let json = record.to_json().expect("Failed to serialize to JSON");
        let decoded: MutationRecord = MutationRecord::from_json(&json).expect("Failed to deserialize from JSON");
        assert_eq!(record, decoded);
    }

    #[test]
    fn test_serialization_roundtrip_bincode() {
        let mut record = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: EntityType::KitchenTicket,
            operation: OperationType::Delete,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 100,
            checksum: String::new(),
        };
        record.checksum = record.compute_checksum();

        let bytes = record.to_bytes().expect("Failed to serialize to bytes");
        let decoded: MutationRecord = MutationRecord::from_bytes(&bytes).expect("Failed to deserialize from bytes");
        assert_eq!(record, decoded);
    }
}
