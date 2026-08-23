use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClientNodeId(pub uuid::Uuid);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VectorClock {
    pub entries: std::collections::HashMap<String, u64>,
}
