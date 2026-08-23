use std::collections::{BTreeMap, HashSet};
use std::fmt;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Client Node Identifier (`ClientNodeId`)
/// Newtype wrapper around String representing a device
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ClientNodeId(String);

impl ClientNodeId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    #[must_use]
    pub fn random() -> Self {
        Self(Uuid::now_v7().to_string())
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ClientNodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<&str> for ClientNodeId {
    fn from(s: &str) -> Self {
        Self::new(s)
    }
}

impl From<String> for ClientNodeId {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

impl From<Uuid> for ClientNodeId {
    fn from(u: Uuid) -> Self {
        Self::new(u.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CausalOrdering {
    /// Both clocks are identical
    Identical,
    /// Clock A strictly happened before Clock B (A < B)
    Precedes,
    /// Clock A strictly happened after Clock B (A > B)
    Succeeds,
    /// Clocks diverged concurrently while offline (A || B)
    Concurrent,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct LogicalTimestamp {
    /// Physical Unix epoch milliseconds for coarse human-readable sorting
    pub wall_clock_ms: i64,
    /// Monotonic sequence counter for fine-grained ordering
    pub counter: u64,
    /// Origin client node ID hash / tie-breaker
    pub node_id: ClientNodeId,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct VectorClock {
    entries: BTreeMap<ClientNodeId, u64>,
}

impl VectorClock {
    #[must_use]
    pub fn new() -> Self {
        Self {
            entries: BTreeMap::new(),
        }
    }

    #[must_use]
    pub fn get(&self, node: &ClientNodeId) -> u64 {
        self.entries.get(node).copied().unwrap_or(0)
    }

    pub fn set(&mut self, node: ClientNodeId, counter: u64) {
        self.entries.insert(node, counter);
    }

    pub fn increment(&mut self, node: &ClientNodeId) -> u64 {
        let count = self.entries.entry(node.clone()).or_insert(0);
        *count += 1;
        *count
    }

    pub fn merge(&mut self, other: &VectorClock) {
        for (node, &other_count) in &other.entries {
            let count = self.entries.entry(node.clone()).or_insert(0);
            *count = (*count).max(other_count);
        }
    }

    #[must_use]
    pub fn compare(&self, other: &VectorClock) -> CausalOrdering {
        let mut self_is_less = false;
        let mut self_is_greater = false;

        let all_nodes: HashSet<_> = self.entries.keys().chain(other.entries.keys()).collect();

        for node in all_nodes {
            let self_count = self.get(node);
            let other_count = other.get(node);

            if self_count < other_count {
                self_is_less = true;
            } else if self_count > other_count {
                self_is_greater = true;
            }
        }

        match (self_is_less, self_is_greater) {
            (false, false) => CausalOrdering::Identical,
            (true, false) => CausalOrdering::Precedes,
            (false, true) => CausalOrdering::Succeeds,
            (true, true) => CausalOrdering::Concurrent,
        }
    }

    #[must_use]
    pub fn is_concurrent_with(&self, other: &VectorClock) -> bool {
        self.compare(other) == CausalOrdering::Concurrent
    }

    /// Serializes the `VectorClock` to bytes.
    /// # Errors
    /// Returns a `bincode::Error` if serialization fails.
    pub fn to_bytes(&self) -> Result<Vec<u8>, bincode::Error> {
        bincode::serialize(self)
    }

    /// Deserializes a `VectorClock` from bytes.
    /// # Errors
    /// Returns a `bincode::Error` if deserialization fails.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_direct_causal_chains() {
        let node_a = ClientNodeId::new("A");
        let node_b = ClientNodeId::new("B");
        let node_c = ClientNodeId::new("C");

        let mut vc1 = VectorClock::new();
        vc1.increment(&node_a); // A=1

        let mut vc2 = vc1.clone();
        vc2.increment(&node_b); // A=1, B=1

        let mut vc3 = vc2.clone();
        vc3.increment(&node_c); // A=1, B=1, C=1

        assert_eq!(vc1.compare(&vc2), CausalOrdering::Precedes);
        assert_eq!(vc2.compare(&vc1), CausalOrdering::Succeeds);
        assert_eq!(vc2.compare(&vc3), CausalOrdering::Precedes);
        assert_eq!(vc1.compare(&vc3), CausalOrdering::Precedes);
        assert_eq!(vc3.compare(&vc1), CausalOrdering::Succeeds);
    }

    #[test]
    fn test_concurrent_divergence() {
        let node1 = ClientNodeId::new("node1");
        let node2 = ClientNodeId::new("node2");

        let mut vc_base = VectorClock::new();
        vc_base.increment(&node1); // node1=1

        let mut vc1 = vc_base.clone();
        vc1.increment(&node1); // node1=2

        let mut vc2 = vc_base.clone();
        vc2.increment(&node2); // node1=1, node2=1

        assert_eq!(vc1.compare(&vc2), CausalOrdering::Concurrent);
        assert_eq!(vc2.compare(&vc1), CausalOrdering::Concurrent);
        assert!(vc1.is_concurrent_with(&vc2));
    }

    #[test]
    fn test_multi_node_merge_convergence() {
        let node_a = ClientNodeId::new("A");
        let node_b = ClientNodeId::new("B");
        let node_c = ClientNodeId::new("C");

        let mut vc1 = VectorClock::new();
        vc1.set(node_a.clone(), 2);
        vc1.set(node_b.clone(), 1);

        let mut vc2 = VectorClock::new();
        vc2.set(node_a.clone(), 1);
        vc2.set(node_b.clone(), 3);
        vc2.set(node_c.clone(), 1);

        let mut vc1_merged = vc1.clone();
        vc1_merged.merge(&vc2);

        let mut vc2_merged = vc2.clone();
        vc2_merged.merge(&vc1);

        assert_eq!(vc1_merged.get(&node_a), 2);
        assert_eq!(vc1_merged.get(&node_b), 3);
        assert_eq!(vc1_merged.get(&node_c), 1);

        assert_eq!(vc1_merged, vc2_merged);
        assert_eq!(vc1_merged.compare(&vc2_merged), CausalOrdering::Identical);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let mut vc = VectorClock::new();
        vc.set(ClientNodeId::new("A"), 10);
        vc.set(ClientNodeId::random(), 5);

        // JSON
        let json = serde_json::to_string(&vc).unwrap();
        let vc_json: VectorClock = serde_json::from_str(&json).unwrap();
        assert_eq!(vc, vc_json);

        // Bincode
        let bytes = vc.to_bytes().unwrap();
        let vc_bytes = VectorClock::from_bytes(&bytes).unwrap();
        assert_eq!(vc, vc_bytes);
    }

    #[test]
    fn test_smoke_e2e_causality_simulation() {
        let pos = ClientNodeId::new("pos");
        let waiter = ClientNodeId::new("waiter");
        let kds = ClientNodeId::new("kds");

        // Initial state
        let mut base_state = VectorClock::new();
        base_state.increment(&pos); // pos=1

        // Waiter syncs
        let mut waiter_state = base_state.clone();

        // POS takes an order
        let mut pos_state = base_state.clone();
        pos_state.increment(&pos); // pos=2

        // Waiter offline takes an order
        waiter_state.increment(&waiter); // pos=1, waiter=1

        // They are concurrent
        assert_eq!(pos_state.compare(&waiter_state), CausalOrdering::Concurrent);

        // POS and Waiter reconnect and sync
        pos_state.merge(&waiter_state);
        waiter_state.merge(&pos_state);
        assert_eq!(pos_state, waiter_state); // pos=2, waiter=1

        // KDS syncs and takes action
        let mut kds_state = pos_state.clone();
        kds_state.increment(&kds); // pos=2, waiter=1, kds=1

        // KDS must succeed pos_state
        assert_eq!(kds_state.compare(&pos_state), CausalOrdering::Succeeds);
        assert_eq!(pos_state.compare(&kds_state), CausalOrdering::Precedes);
    }
}
