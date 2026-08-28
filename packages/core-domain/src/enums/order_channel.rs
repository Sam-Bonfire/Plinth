use serde::{Deserialize, Serialize};
use std::fmt::{self, Display};

/// The channel through which an order was placed.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum OrderChannel {
    /// Dine in at the restaurant
    DineIn,
    /// Customer takes away the food
    Takeaway,
    /// Delivery by restaurant staff
    Delivery,
    /// Swiggy aggregator
    Swiggy,
    /// Zomato aggregator
    Zomato,
}

impl OrderChannel {
    /// Checks if the channel is an aggregator
    #[must_use]
    pub fn is_aggregator(&self) -> bool {
        matches!(self, Self::Swiggy | Self::Zomato)
    }

    /// Checks if the channel requires packaging
    #[must_use]
    pub fn requires_packaging(&self) -> bool {
        matches!(
            self,
            Self::Takeaway | Self::Delivery | Self::Swiggy | Self::Zomato
        )
    }
}

impl Display for OrderChannel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DineIn => write!(f, "Dine In"),
            Self::Takeaway => write!(f, "Takeaway"),
            Self::Delivery => write!(f, "Delivery"),
            Self::Swiggy => write!(f, "Swiggy"),
            Self::Zomato => write!(f, "Zomato"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_aggregator() {
        assert!(!OrderChannel::DineIn.is_aggregator());
        assert!(OrderChannel::Swiggy.is_aggregator());
        assert!(OrderChannel::Zomato.is_aggregator());
    }

    #[test]
    fn test_requires_packaging() {
        assert!(!OrderChannel::DineIn.requires_packaging());
        assert!(OrderChannel::Takeaway.requires_packaging());
        assert!(OrderChannel::Delivery.requires_packaging());
        assert!(OrderChannel::Swiggy.requires_packaging());
    }

    #[test]
    fn test_display() {
        assert_eq!(OrderChannel::DineIn.to_string(), "Dine In");
        assert_eq!(OrderChannel::Zomato.to_string(), "Zomato");
    }
}
