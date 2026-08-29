use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Error for invalid kitchen ticket status transitions
#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("Invalid kitchen ticket status transition from {from:?} to {to:?}")]
pub struct KitchenTicketStatusError {
    /// The current status
    pub from: KitchenTicketStatus,
    /// The target status
    pub to: KitchenTicketStatus,
}

/// Kitchen display station identifier
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum StationId {
    /// Grill station
    Grill,
    /// Tandoor station
    Tandoor,
    /// Main Kitchen station
    MainKitchen,
    /// Cold Station
    ColdStation,
    /// Beverages station
    Beverages,
    /// Desserts station
    Desserts,
    /// Custom station
    Custom(String),
}

impl StationId {
    /// Returns the display name of the station
    #[must_use]
    pub fn display_name(&self) -> &str {
        match self {
            Self::Grill => "Grill",
            Self::Tandoor => "Tandoor",
            Self::MainKitchen => "Main Kitchen",
            Self::ColdStation => "Cold Station",
            Self::Beverages => "Beverages",
            Self::Desserts => "Desserts",
            Self::Custom(name) => name.as_str(),
        }
    }
}

/// The status of a kitchen ticket
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum KitchenTicketStatus {
    /// Ticket is pending
    Pending,
    /// Ticket is in preparation
    InPrep,
    /// Ticket is ready
    Ready,
    /// Ticket is bumped (completed/cleared)
    Bumped,
    /// Ticket is cancelled
    Cancelled,
}

impl KitchenTicketStatus {
    /// Checks if a transition to the target status is valid
    #[must_use]
    pub fn can_transition_to(&self, target: &KitchenTicketStatus) -> bool {
        matches!(
            (self, target),
            (Self::Pending, Self::InPrep | Self::Cancelled)
                | (Self::InPrep, Self::Ready | Self::Cancelled)
                | (Self::Ready, Self::Bumped | Self::Cancelled)
        )
    }

    /// Checks if the status is terminal (cannot transition further)
    #[must_use]
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Bumped | Self::Cancelled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_station_display_name() {
        assert_eq!(StationId::Grill.display_name(), "Grill");
        assert_eq!(StationId::Custom("Pizza".to_string()).display_name(), "Pizza");
    }

    #[test]
    fn test_valid_transitions() {
        assert!(KitchenTicketStatus::Pending.can_transition_to(&KitchenTicketStatus::InPrep));
        assert!(KitchenTicketStatus::InPrep.can_transition_to(&KitchenTicketStatus::Ready));
        assert!(KitchenTicketStatus::Ready.can_transition_to(&KitchenTicketStatus::Bumped));
        assert!(KitchenTicketStatus::Pending.can_transition_to(&KitchenTicketStatus::Cancelled));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!KitchenTicketStatus::Pending.can_transition_to(&KitchenTicketStatus::Ready));
        assert!(!KitchenTicketStatus::Bumped.can_transition_to(&KitchenTicketStatus::Pending));
    }

    #[test]
    fn test_is_terminal() {
        assert!(KitchenTicketStatus::Bumped.is_terminal());
        assert!(KitchenTicketStatus::Cancelled.is_terminal());
        assert!(!KitchenTicketStatus::Pending.is_terminal());
    }
}
