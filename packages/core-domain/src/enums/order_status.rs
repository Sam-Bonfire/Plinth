use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Error for invalid order status transitions
#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("Invalid order status transition from {from:?} to {to:?}")]
pub struct OrderStatusError {
    /// The current status
    pub from: OrderStatus,
    /// The target status
    pub to: OrderStatus,
}

/// The status of an order
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum OrderStatus {
    /// Initial draft state
    Draft,
    /// Order is confirmed
    Confirmed,
    /// Order is being prepared
    Preparing,
    /// Order is ready to be served/delivered
    Ready,
    /// Order has been served/delivered
    Served,
    /// Order is settled/paid
    Settled,
    /// Order is voided
    Voided,
    /// Order is refunded
    Refunded,
}

impl OrderStatus {
    /// Checks if a transition to the target status is valid
    #[must_use]
    pub fn can_transition_to(&self, target: &OrderStatus) -> bool {
        matches!(
            (self, target),
            (Self::Draft, Self::Confirmed)
                | (Self::Confirmed, Self::Preparing | Self::Voided)
                | (Self::Preparing, Self::Ready | Self::Voided)
                | (Self::Ready, Self::Served | Self::Voided)
                | (Self::Served, Self::Settled | Self::Voided)
                | (Self::Settled, Self::Refunded)
        )
    }

    /// Checks if the status is terminal (cannot transition further)
    #[must_use]
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Voided | Self::Refunded)
    }

    /// Attempts to transition to the target status, returning an error if invalid
    ///
    /// # Errors
    /// Returns `OrderStatusError` if the transition is invalid.
    pub fn transition_to(&self, target: OrderStatus) -> Result<OrderStatus, OrderStatusError> {
        if self.can_transition_to(&target) {
            Ok(target)
        } else {
            Err(OrderStatusError {
                from: *self,
                to: target,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(OrderStatus::Draft.can_transition_to(&OrderStatus::Confirmed));
        assert!(OrderStatus::Confirmed.can_transition_to(&OrderStatus::Preparing));
        assert!(OrderStatus::Preparing.can_transition_to(&OrderStatus::Ready));
        assert!(OrderStatus::Ready.can_transition_to(&OrderStatus::Served));
        assert!(OrderStatus::Served.can_transition_to(&OrderStatus::Settled));
        assert!(OrderStatus::Settled.can_transition_to(&OrderStatus::Refunded));
        assert!(OrderStatus::Confirmed.can_transition_to(&OrderStatus::Voided));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!OrderStatus::Draft.can_transition_to(&OrderStatus::Ready));
        assert!(!OrderStatus::Settled.can_transition_to(&OrderStatus::Draft));
        assert!(!OrderStatus::Voided.can_transition_to(&OrderStatus::Draft));
    }

    #[test]
    fn test_is_terminal() {
        assert!(OrderStatus::Voided.is_terminal());
        assert!(OrderStatus::Refunded.is_terminal());
        assert!(!OrderStatus::Draft.is_terminal());
    }
}
