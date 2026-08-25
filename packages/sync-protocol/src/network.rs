use crate::clock::VectorClock;
use crate::mutation::{MutationRecord, EntityType};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkState {
    Online { server_id: String, latency_ms: u64 },
    Reconnecting { attempt: u32 },
    Offline { reason: String, detected_at: DateTime<Utc> },
    Syncing { pending_mutations: u32 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WatchdogAction {
    SendPing,
    TriggerOfflineMode,
    None,
}

pub struct HeartbeatWatchdog {
    last_ping: Option<DateTime<Utc>>,
    last_pong: Option<DateTime<Utc>>,
    missed_pings: u32,
}

impl Default for HeartbeatWatchdog {
    fn default() -> Self {
        Self::new()
    }
}

impl HeartbeatWatchdog {
    #[must_use]
    pub fn new() -> Self {
        Self {
            last_ping: None,
            last_pong: None,
            missed_pings: 0,
        }
    }

    pub fn receive_pong(&mut self, now: DateTime<Utc>) {
        self.last_pong = Some(now);
        self.missed_pings = 0;
    }

    pub fn tick(&mut self, now: DateTime<Utc>) -> WatchdogAction {
        let ping_interval = chrono::Duration::seconds(5);

        if let Some(last_ping_time) = self.last_ping {
            if now.signed_duration_since(last_ping_time) >= ping_interval {
                if let Some(last_pong_time) = self.last_pong {
                    if last_ping_time > last_pong_time {
                        self.missed_pings += 1;
                    }
                } else {
                    self.missed_pings += 1;
                }

                if self.missed_pings >= 3 {
                    return WatchdogAction::TriggerOfflineMode;
                }

                self.last_ping = Some(now);
                return WatchdogAction::SendPing;
            }
            WatchdogAction::None
        } else {
            self.last_ping = Some(now);
            WatchdogAction::SendPing
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SyncSealError {
    #[error("Shift is already sealed")]
    ShiftAlreadySealed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftSyncSeal {
    pub shift_id: String,
    pub closed_at: DateTime<Utc>,
    pub final_vector_clock: VectorClock,
    pub closing_signature: String,
    pub z_report_hash: String,
}

impl ShiftSyncSeal {
    /// # Errors
    /// Returns `SyncSealError` if the mutation is attempted against a sealed shift.
    pub fn validate_mutation_against_seal(
        mutation: &MutationRecord,
        active_seals: &[Self],
    ) -> Result<(), SyncSealError> {
        let shift_id = if let EntityType::Custom(ref s) = mutation.entity_type {
            if s == "StoreShift" {
                Some(mutation.entity_id)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(ref target_shift) = shift_id {
             if active_seals.iter().any(|seal| seal.shift_id == target_shift.to_string()) {
                 return Err(SyncSealError::ShiftAlreadySealed);
             }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Default)]
pub struct SyncTelemetry {
    pub total_mutations_enqueued: u64,
    pub total_mutations_synced: u64,
    pub total_conflicts_resolved: u64,
    pub total_dead_letter_quarantines: u64,
    pub average_latency_ms: u64,
}

impl SyncTelemetry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}
