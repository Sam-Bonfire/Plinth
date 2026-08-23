use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ClientNodeId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct LogicalTimestamp {
    pub physical: u64,
    pub counter: u64,
    pub node_id: ClientNodeId,
}

impl LogicalTimestamp {
    #[must_use]
    pub fn new(physical: u64, counter: u64, node_id: ClientNodeId) -> Self {
        Self {
            physical,
            counter,
            node_id,
        }
    }
}
