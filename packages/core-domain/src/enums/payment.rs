use serde::{Deserialize, Serialize};

/// The method used for payment
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum PaymentMethod {
    /// Cash payment
    Cash,
    /// UPI payment
    Upi,
    /// Card payment
    Card,
    /// Wallet payment
    Wallet,
}

impl PaymentMethod {
    /// Returns the display name of the payment method
    #[must_use]
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Cash => "Cash",
            Self::Upi => "UPI",
            Self::Card => "Card",
            Self::Wallet => "Wallet",
        }
    }
}

/// The status of a payment
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
pub enum PaymentStatus {
    /// Payment is pending
    Pending,
    /// Payment is completed
    Completed,
    /// Payment has failed
    Failed,
    /// Payment is refunded
    Refunded,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_display_name() {
        assert_eq!(PaymentMethod::Cash.display_name(), "Cash");
        assert_eq!(PaymentMethod::Upi.display_name(), "UPI");
    }
}
