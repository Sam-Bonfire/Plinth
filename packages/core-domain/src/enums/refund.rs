use serde::{Deserialize, Serialize};

/// Reason for a refund
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RefundReason {
    /// Wrong item provided
    WrongItem,
    /// Quality issue
    QualityIssue,
    /// Customer complaint
    CustomerComplaint,
    /// Duplicate charge
    DuplicateCharge,
    /// Order cancellation
    OrderCancellation,
    /// Custom reason
    Custom(String),
}

/// Type of refund
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RefundType {
    /// Full refund
    Full,
    /// Partial refund
    Partial,
    /// Refund for a specific line item
    LineItem,
}

/// Status of a refund
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RefundStatus {
    /// Refund is pending
    Pending,
    /// Refund is approved
    Approved,
    /// Refund is processed
    Processed,
    /// Refund is rejected
    Rejected,
}

impl RefundStatus {
    /// Checks if a transition to the target status is valid
    #[must_use]
    pub fn can_transition_to(&self, target: &RefundStatus) -> bool {
        matches!(
            (self, target),
            (Self::Pending, Self::Approved | Self::Rejected)
                | (Self::Approved, Self::Processed)
        )
    }

    /// Checks if the status is terminal
    #[must_use]
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Processed | Self::Rejected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(RefundStatus::Pending.can_transition_to(&RefundStatus::Approved));
        assert!(RefundStatus::Pending.can_transition_to(&RefundStatus::Rejected));
        assert!(RefundStatus::Approved.can_transition_to(&RefundStatus::Processed));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!RefundStatus::Pending.can_transition_to(&RefundStatus::Processed));
        assert!(!RefundStatus::Processed.can_transition_to(&RefundStatus::Pending));
    }
}
