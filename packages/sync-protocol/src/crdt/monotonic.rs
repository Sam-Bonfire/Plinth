use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::clock::LogicalTimestamp;

pub trait StateLattice: Clone + PartialEq + Eq + Serialize {
    fn rank(&self) -> u32;
    fn can_transition_to(&self, target: &Self) -> bool;
    fn is_terminal(&self) -> bool;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevisionState<S: StateLattice> {
    state: S,
    revision: u64,
    timestamp: LogicalTimestamp,
    updated_by: Option<Uuid>,
    recall_reason: Option<String>,
}

impl<S: StateLattice> RevisionState<S> {
    #[must_use]
    pub fn new(initial_state: S, timestamp: LogicalTimestamp, updated_by: Option<Uuid>) -> Self {
        Self {
            state: initial_state,
            revision: 1,
            timestamp,
            updated_by,
            recall_reason: None,
        }
    }

    #[must_use]
    pub fn state(&self) -> &S {
        &self.state
    }

    #[must_use]
    pub fn revision(&self) -> u64 {
        self.revision
    }

    #[must_use]
    pub fn timestamp(&self) -> &LogicalTimestamp {
        &self.timestamp
    }

    #[must_use]
    pub fn updated_by(&self) -> Option<Uuid> {
        self.updated_by
    }

    /// Transitions to the next state, incrementing the revision.
    ///
    /// # Errors
    /// Returns an error if the transition is invalid based on the current state.
    pub fn transition_to(&mut self, next_state: S, timestamp: LogicalTimestamp, actor: Option<Uuid>) -> Result<(), &'static str> {
        if !self.state.can_transition_to(&next_state) {
            return Err("Invalid state transition");
        }

        self.revision += 1;
        self.state = next_state;
        self.timestamp = timestamp;
        self.updated_by = actor;
        self.recall_reason = None;

        Ok(())
    }

    /// Recalls to a target state, incrementing the revision.
    ///
    /// # Errors
    /// Returns an error if the state cannot be recalled.
    pub fn recall_to(&mut self, target_state: S, reason: impl Into<String>, timestamp: LogicalTimestamp, actor: Option<Uuid>) -> Result<(), &'static str> {
        self.revision += 1;
        self.state = target_state;
        self.timestamp = timestamp;
        self.updated_by = actor;
        self.recall_reason = Some(reason.into());

        Ok(())
    }

    /// Merges another state with this one.
    /// Returns true if this state was modified.
    pub fn merge(&mut self, other: &Self) -> bool {
        if other.revision > self.revision {
            self.clone_from(other);
            return true;
        }

        if other.revision < self.revision {
            return false;
        }

        if other.state.rank() > self.state.rank() {
            self.clone_from(other);
            return true;
        }

        if other.state.rank() == self.state.rank() && other.timestamp > self.timestamp {
            self.clone_from(other);
            return true;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
    enum OrderState {
        Pending,
        InPrep,
        Ready,
        Bumped,
    }

    impl StateLattice for OrderState {
        fn rank(&self) -> u32 {
            match self {
                OrderState::Pending => 1,
                OrderState::InPrep => 2,
                OrderState::Ready => 3,
                OrderState::Bumped => 4,
            }
        }

        fn can_transition_to(&self, target: &Self) -> bool {
            // Normal forward flow
            matches!(
                (self, target),
                (OrderState::Pending, OrderState::InPrep)
                    | (OrderState::InPrep, OrderState::Ready)
                    | (OrderState::Ready, OrderState::Bumped)
            )
        }

        fn is_terminal(&self) -> bool {
            matches!(self, OrderState::Bumped)
        }
    }

    fn test_ts(counter: u64) -> LogicalTimestamp {
        LogicalTimestamp {
            wall_clock_ms: 1_700_000_000_000,
            counter,
            node_id: crate::clock::ClientNodeId::new("node-1"),
        }
    }

    #[test]
    fn test_normal_forward_lifecycle() {
        let ts1 = test_ts(1);
        let mut state = RevisionState::new(OrderState::Pending, ts1.clone(), None);
        assert_eq!(state.revision(), 1);
        assert_eq!(state.state(), &OrderState::Pending);

        let ts2 = test_ts(2);
        assert!(state.transition_to(OrderState::InPrep, ts2.clone(), None).is_ok());
        assert_eq!(state.revision(), 2);
        assert_eq!(state.state(), &OrderState::InPrep);

        let ts3 = test_ts(3);
        assert!(state.transition_to(OrderState::Ready, ts3.clone(), None).is_ok());
        assert_eq!(state.revision(), 3);
        assert_eq!(state.state(), &OrderState::Ready);

        let ts4 = test_ts(4);
        assert!(state.transition_to(OrderState::Bumped, ts4.clone(), None).is_ok());
        assert_eq!(state.revision(), 4);
        assert_eq!(state.state(), &OrderState::Bumped);
    }

    #[test]
    fn test_stale_delayed_packet_rejection() {
        let mut bumped_state = RevisionState::new(OrderState::Pending, test_ts(1), None);
        bumped_state.transition_to(OrderState::InPrep, test_ts(2), None).unwrap();
        bumped_state.transition_to(OrderState::Ready, test_ts(3), None).unwrap();
        bumped_state.transition_to(OrderState::Bumped, test_ts(4), None).unwrap();

        let mut delayed_state = RevisionState::new(OrderState::Pending, test_ts(1), None);
        delayed_state.transition_to(OrderState::InPrep, test_ts(2), None).unwrap();

        assert_eq!(bumped_state.revision(), 4);
        assert_eq!(delayed_state.revision(), 2);

        // Merging delayed into bumped should not change bumped
        let modified = bumped_state.merge(&delayed_state);
        assert!(!modified);
        assert_eq!(bumped_state.state(), &OrderState::Bumped);
        assert_eq!(bumped_state.revision(), 4);
    }

    #[test]
    fn test_intentional_recall() {
        let mut state = RevisionState::new(OrderState::Pending, test_ts(1), None);
        state.transition_to(OrderState::InPrep, test_ts(2), None).unwrap();
        state.transition_to(OrderState::Ready, test_ts(3), None).unwrap();
        state.transition_to(OrderState::Bumped, test_ts(4), None).unwrap();

        // Recall to InPrep
        state.recall_to(OrderState::InPrep, "Customer changed seat", test_ts(5), None).unwrap();
        assert_eq!(state.revision(), 5);
        assert_eq!(state.state(), &OrderState::InPrep);

        // This recalled state should overwrite the earlier Bumped state across network
        let mut stale_bumped = state.clone();
        stale_bumped.revision = 4;
        stale_bumped.state = OrderState::Bumped;

        let modified = stale_bumped.merge(&state);
        assert!(modified);
        assert_eq!(stale_bumped.state(), &OrderState::InPrep);
        assert_eq!(stale_bumped.revision(), 5);
    }

    #[test]
    fn test_crdt_convergence_invariants() {
        let ts_a = test_ts(1);
        let ts_b = test_ts(2);
        let ts_c = test_ts(3);

        let a = RevisionState::new(OrderState::Pending, ts_a, None);
        let mut b = a.clone();
        b.transition_to(OrderState::InPrep, ts_b, None).unwrap();
        let mut c = b.clone();
        c.transition_to(OrderState::Ready, ts_c, None).unwrap();

        // Idempotency: merge(A, A) == A
        let mut a_copy = a.clone();
        a_copy.merge(&a);
        assert_eq!(a_copy, a);

        // Commutativity: merge(A, B) == merge(B, A)
        let mut a_merge_b = a.clone();
        a_merge_b.merge(&b);
        let mut b_merge_a = b.clone();
        b_merge_a.merge(&a);
        assert_eq!(a_merge_b, b_merge_a);

        // Associativity: merge(A, merge(B, C)) == merge(merge(A, B), C)
        let mut b_merge_c = b.clone();
        b_merge_c.merge(&c);
        let mut left = a.clone();
        left.merge(&b_merge_c);

        let mut a_merge_b = a.clone();
        a_merge_b.merge(&b);
        let mut right = a_merge_b;
        right.merge(&c);

        assert_eq!(left, right);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let state = RevisionState::new(OrderState::Pending, test_ts(1), None);

        let json = serde_json::to_string(&state).unwrap();
        let deserialized: RevisionState<OrderState> = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deserialized);

        let bincode_vec = bincode::serialize(&state).unwrap();
        let deserialized_bincode: RevisionState<OrderState> = bincode::deserialize(&bincode_vec).unwrap();
        assert_eq!(state, deserialized_bincode);
    }
}
