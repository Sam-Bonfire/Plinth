use std::collections::{HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::clock::{ClientNodeId, VectorClock};
use crate::mutation::MutationRecord;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum SyncFrame {
    /// Initial client handshake carrying terminal ID and current local vector clock
    ClientHello {
        node_id: ClientNodeId,
        auth_token: String,
        current_clock: VectorClock,
        protocol_version: u32,
    },
    /// Server handshake acceptance returning latest server clock and initial backlog
    ServerWelcome {
        server_node_id: ClientNodeId,
        server_clock: VectorClock,
        session_id: Uuid,
        server_time: DateTime<Utc>,
    },
    /// Push batch of mutations from client to server or server to peer
    PushMutations {
        batch_id: Uuid,
        sender_node_id: ClientNodeId,
        mutations: Vec<MutationRecord>,
        is_urgent: bool,
    },
    /// Acknowledgment of successfully received and persisted mutation IDs
    AckMutations {
        batch_id: Uuid,
        acked_mutation_ids: Vec<Uuid>,
        updated_clock: VectorClock,
    },
    /// Heartbeat ping for connection keep-alive and latency measurement
    HeartbeatPing {
        client_time_ms: i64,
    },
    /// Heartbeat pong echo
    HeartbeatPong {
        client_time_ms: i64,
        server_time_ms: i64,
    },
    /// Protocol or authentication error message
    Error {
        code: String,
        message: String,
        fatal: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
enum SyncFrameBincode {
    ClientHello {
        node_id: ClientNodeId,
        auth_token: String,
        current_clock: VectorClock,
        protocol_version: u32,
    },
    ServerWelcome {
        server_node_id: ClientNodeId,
        server_clock: VectorClock,
        session_id: Uuid,
        server_time: DateTime<Utc>,
    },
    PushMutations {
        batch_id: Uuid,
        sender_node_id: ClientNodeId,
        mutations: Vec<MutationRecord>,
        is_urgent: bool,
    },
    AckMutations {
        batch_id: Uuid,
        acked_mutation_ids: Vec<Uuid>,
        updated_clock: VectorClock,
    },
    HeartbeatPing {
        client_time_ms: i64,
    },
    HeartbeatPong {
        client_time_ms: i64,
        server_time_ms: i64,
    },
    Error {
        code: String,
        message: String,
        fatal: bool,
    },
}

impl From<&SyncFrame> for SyncFrameBincode {
    fn from(frame: &SyncFrame) -> Self {
        match frame {
            SyncFrame::ClientHello { node_id, auth_token, current_clock, protocol_version } => {
                SyncFrameBincode::ClientHello {
                    node_id: node_id.clone(),
                    auth_token: auth_token.clone(),
                    current_clock: current_clock.clone(),
                    protocol_version: *protocol_version,
                }
            }
            SyncFrame::ServerWelcome { server_node_id, server_clock, session_id, server_time } => {
                SyncFrameBincode::ServerWelcome {
                    server_node_id: server_node_id.clone(),
                    server_clock: server_clock.clone(),
                    session_id: *session_id,
                    server_time: *server_time,
                }
            }
            SyncFrame::PushMutations { batch_id, sender_node_id, mutations, is_urgent } => {
                SyncFrameBincode::PushMutations {
                    batch_id: *batch_id,
                    sender_node_id: sender_node_id.clone(),
                    mutations: mutations.clone(),
                    is_urgent: *is_urgent,
                }
            }
            SyncFrame::AckMutations { batch_id, acked_mutation_ids, updated_clock } => {
                SyncFrameBincode::AckMutations {
                    batch_id: *batch_id,
                    acked_mutation_ids: acked_mutation_ids.clone(),
                    updated_clock: updated_clock.clone(),
                }
            }
            SyncFrame::HeartbeatPing { client_time_ms } => {
                SyncFrameBincode::HeartbeatPing {
                    client_time_ms: *client_time_ms,
                }
            }
            SyncFrame::HeartbeatPong { client_time_ms, server_time_ms } => {
                SyncFrameBincode::HeartbeatPong {
                    client_time_ms: *client_time_ms,
                    server_time_ms: *server_time_ms,
                }
            }
            SyncFrame::Error { code, message, fatal } => {
                SyncFrameBincode::Error {
                    code: code.clone(),
                    message: message.clone(),
                    fatal: *fatal,
                }
            }
        }
    }
}

impl From<SyncFrameBincode> for SyncFrame {
    fn from(frame: SyncFrameBincode) -> Self {
        match frame {
            SyncFrameBincode::ClientHello { node_id, auth_token, current_clock, protocol_version } => {
                SyncFrame::ClientHello { node_id, auth_token, current_clock, protocol_version }
            }
            SyncFrameBincode::ServerWelcome { server_node_id, server_clock, session_id, server_time } => {
                SyncFrame::ServerWelcome { server_node_id, server_clock, session_id, server_time }
            }
            SyncFrameBincode::PushMutations { batch_id, sender_node_id, mutations, is_urgent } => {
                SyncFrame::PushMutations { batch_id, sender_node_id, mutations, is_urgent }
            }
            SyncFrameBincode::AckMutations { batch_id, acked_mutation_ids, updated_clock } => {
                SyncFrame::AckMutations { batch_id, acked_mutation_ids, updated_clock }
            }
            SyncFrameBincode::HeartbeatPing { client_time_ms } => {
                SyncFrame::HeartbeatPing { client_time_ms }
            }
            SyncFrameBincode::HeartbeatPong { client_time_ms, server_time_ms } => {
                SyncFrame::HeartbeatPong { client_time_ms, server_time_ms }
            }
            SyncFrameBincode::Error { code, message, fatal } => {
                SyncFrame::Error { code, message, fatal }
            }
        }
    }
}

impl SyncFrame {
    /// Serializes the frame into a JSON string
    ///
    /// # Errors
    /// Returns an error if serialization fails
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserializes the frame from a JSON string
    ///
    /// # Errors
    /// Returns an error if the JSON is malformed or invalid for a `SyncFrame`
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serializes the frame into Bincode bytes, bypassing internally tagged enum issues
    ///
    /// # Errors
    /// Returns an error if Bincode serialization fails
    pub fn to_bytes(&self) -> Result<Vec<u8>, bincode::Error> {
        let bincode_rep: SyncFrameBincode = self.into();
        bincode::serialize(&bincode_rep)
    }

    /// Deserializes the frame from Bincode bytes
    ///
    /// # Errors
    /// Returns an error if Bincode deserialization fails
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, bincode::Error> {
        let bincode_rep: SyncFrameBincode = bincode::deserialize(bytes)?;
        Ok(bincode_rep.into())
    }
}

/// Buffers pending mutations and generates `PushMutations` sync frames based on size and urgency thresholds
#[derive(Debug, Clone)]
pub struct BatchPacker {
    node_id: ClientNodeId,
    max_batch_size: usize,
    buffer: Vec<MutationRecord>,
}

impl BatchPacker {
    #[must_use]
    pub fn new(node_id: ClientNodeId, max_batch_size: usize) -> Self {
        Self {
            node_id,
            max_batch_size,
            buffer: Vec::with_capacity(max_batch_size),
        }
    }

    pub fn push(&mut self, mutation: MutationRecord) -> Option<SyncFrame> {
        let is_urgent = mutation.is_urgent;
        self.buffer.push(mutation);

        if is_urgent || self.buffer.len() >= self.max_batch_size {
            self.flush()
        } else {
            None
        }
    }

    pub fn flush(&mut self) -> Option<SyncFrame> {
        if self.buffer.is_empty() {
            return None;
        }

        let is_urgent = self.buffer.iter().any(|m| m.is_urgent);
        let mutations = std::mem::take(&mut self.buffer);

        Some(SyncFrame::PushMutations {
            batch_id: Uuid::now_v7(),
            sender_node_id: self.node_id.clone(),
            mutations,
            is_urgent,
        })
    }

    #[must_use]
    pub fn pending_count(&self) -> usize {
        self.buffer.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }
}

/// Bounded LRU cache tracking recently processed mutation IDs to ensure strict idempotency across network retries
#[derive(Debug, Clone)]
pub struct DeduplicationCache {
    capacity: usize,
    set: HashSet<Uuid>,
    queue: VecDeque<Uuid>,
}

impl DeduplicationCache {
    #[must_use]
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            set: HashSet::with_capacity(capacity),
            queue: VecDeque::with_capacity(capacity),
        }
    }

    pub fn check_and_insert(&mut self, id: Uuid) -> bool {
        if self.set.contains(&id) {
            return false;
        }

        if self.queue.len() >= self.capacity {
            if let Some(oldest) = self.queue.pop_front() {
                self.set.remove(&oldest);
            }
        }

        self.set.insert(id);
        self.queue.push_back(id);
        true
    }

    #[must_use]
    pub fn contains(&self, id: &Uuid) -> bool {
        self.set.contains(id)
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.set.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.set.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use uuid::Uuid;
    use chrono::Utc;

    fn dummy_vector_clock() -> VectorClock {
        let mut entries = BTreeMap::new();
        entries.insert(ClientNodeId("node_a".to_string()), 1);

        VectorClock::new()
    }

    #[test]
    fn test_sync_frame_serialization() {
        let frame = SyncFrame::HeartbeatPing { client_time_ms: 12345 };

        // JSON
        let json = frame.to_json().expect("Failed to serialize to JSON");
        let parsed: SyncFrame = SyncFrame::from_json(&json).expect("Failed to deserialize from JSON");
        assert_eq!(frame, parsed);

        // Bincode
        let bytes = frame.to_bytes().expect("Failed to serialize to Bincode");
        let parsed_bytes: SyncFrame = SyncFrame::from_bytes(&bytes).expect("Failed to deserialize from Bincode");
        assert_eq!(frame, parsed_bytes);
    }

    #[test]
    fn test_sync_frame_all_variants_roundtrip() {
        let frames = vec![
            SyncFrame::ClientHello {
                node_id: ClientNodeId(Uuid::now_v7().to_string()),
                auth_token: "token".to_string(),
                current_clock: dummy_vector_clock(),
                protocol_version: 1,
            },
            SyncFrame::ServerWelcome {
                server_node_id: ClientNodeId(Uuid::now_v7().to_string()),
                server_clock: dummy_vector_clock(),
                session_id: Uuid::now_v7(),
                server_time: Utc::now(),
            },
            SyncFrame::PushMutations {
                batch_id: Uuid::now_v7(),
                sender_node_id: ClientNodeId(Uuid::now_v7().to_string()),
                mutations: vec![
                    MutationRecord {
                        mutation_id: Uuid::now_v7(),
                        session_id: Uuid::now_v7(),
                        entity_id: Uuid::now_v7(),
                        entity_type: crate::mutation::EntityType::Order,
                        operation: crate::mutation::OperationType::Create,
                        payload_json: "{}".to_string(),
                        timestamp: Utc::now(),
                        is_urgent: false,
                        logical_clock: 1,
                        checksum: "test_checksum".to_string(),
                    },
                ],
                is_urgent: false,
            },
            SyncFrame::AckMutations {
                batch_id: Uuid::now_v7(),
                acked_mutation_ids: vec![Uuid::now_v7()],
                updated_clock: dummy_vector_clock(),
            },
            SyncFrame::HeartbeatPing { client_time_ms: 100 },
            SyncFrame::HeartbeatPong { client_time_ms: 100, server_time_ms: 200 },
            SyncFrame::Error {
                code: "ERR_CODE".to_string(),
                message: "Error msg".to_string(),
                fatal: true,
            },
        ];

        for frame in frames {
            // JSON roundtrip
            let json = frame.to_json().expect("JSON serialization failed");
            let json_deserialized = SyncFrame::from_json(&json).expect("JSON deserialization failed");
            assert_eq!(frame, json_deserialized);

            // Bincode roundtrip
            let bytes = frame.to_bytes().expect("Bincode serialization failed");
            let bincode_deserialized = SyncFrame::from_bytes(&bytes).expect("Bincode deserialization failed");
            assert_eq!(frame, bincode_deserialized);
        }
    }

    #[test]
    fn test_batch_packer_threshold() {
        let node_id = ClientNodeId(Uuid::now_v7().to_string());
        let mut packer = BatchPacker::new(node_id, 3);

        let m1 = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: crate::mutation::EntityType::Order,
            operation: crate::mutation::OperationType::Create,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 1,
                        checksum: "test_checksum".to_string(),
        };
        let m2 = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: crate::mutation::EntityType::Order,
            operation: crate::mutation::OperationType::Create,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 2,
            checksum: "test_checksum".to_string(),
        };
        let m3 = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: crate::mutation::EntityType::Order,
            operation: crate::mutation::OperationType::Create,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 3,
            checksum: "test_checksum".to_string(),
        };

        // Should return None for the first two
        assert!(packer.push(m1).is_none());
        assert_eq!(packer.pending_count(), 1);

        assert!(packer.push(m2).is_none());
        assert_eq!(packer.pending_count(), 2);

        // 3rd reaches the threshold, returns Some(PushMutations)
        let frame = packer.push(m3).expect("Expected flush at max batch size");
        if let SyncFrame::PushMutations { mutations, is_urgent, .. } = frame {
            assert_eq!(mutations.len(), 3);
            assert!(!is_urgent);
        } else {
            panic!("Expected PushMutations");
        }

        assert!(packer.is_empty());
    }

    #[test]
    fn test_batch_packer_urgency() {
        let node_id = ClientNodeId(Uuid::now_v7().to_string());
        let mut packer = BatchPacker::new(node_id, 50);

        let m1 = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: crate::mutation::EntityType::Order,
            operation: crate::mutation::OperationType::Create,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 1,
                        checksum: "test_checksum".to_string(),
        };
        let m2_urgent = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: crate::mutation::EntityType::Order,
            operation: crate::mutation::OperationType::Create,
            payload_json: "{}".to_string(),
            timestamp: Utc::now(),
            is_urgent: true,
            logical_clock: 2,
            checksum: "test_checksum".to_string(),
        };

        assert!(packer.push(m1).is_none());

        // Urgent mutation forces immediate flush
        let frame = packer.push(m2_urgent).expect("Expected flush on urgent mutation");
        if let SyncFrame::PushMutations { mutations, is_urgent, .. } = frame {
            assert_eq!(mutations.len(), 2);
            assert!(is_urgent);
        } else {
            panic!("Expected PushMutations");
        }
    }

    #[test]
    fn test_deduplication_cache() {
        let mut cache = DeduplicationCache::new(2);
        let id1 = Uuid::now_v7();
        let id2 = Uuid::now_v7();
        let id3 = Uuid::now_v7();

        assert!(cache.check_and_insert(id1));
        assert!(!cache.check_and_insert(id1)); // Duplicate

        assert!(cache.check_and_insert(id2));
        assert_eq!(cache.len(), 2);

        // Inserting 3rd item evicts the 1st (capacity is 2)
        assert!(cache.check_and_insert(id3));
        assert_eq!(cache.len(), 2);

        assert!(!cache.contains(&id1));
        assert!(cache.contains(&id2));
        assert!(cache.contains(&id3));
    }
}
