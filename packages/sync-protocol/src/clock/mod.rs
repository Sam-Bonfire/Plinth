use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ClientNodeId(pub String);

impl From<&str> for ClientNodeId {
    fn from(s: &str) -> Self {
        ClientNodeId(s.to_string())
    }
}
