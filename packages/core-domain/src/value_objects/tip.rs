use crate::ids::StaffMemberId;
use crate::value_objects::money::Money;
use rust_decimal::Decimal;

use serde::{Deserialize, Serialize};

/// Denotes how a tip was calculated
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TipType {
    /// Percentage of the subtotal
    Percentage(Decimal),
    /// Flat provided tip
    Flat(Money),
}

/// Represents a tip given on an order
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TipAmount {
    /// Method of computation
    pub tip_type: TipType,
    /// The computed flat monetary value
    pub computed_amount: Money,
    /// Optional staff member who receives this tip
    pub recipient: Option<StaffMemberId>,
}

impl TipAmount {
    /// Calculates tip from a percentage.
    #[must_use]
    pub fn from_percentage(
        rate: Decimal,
        subtotal: &Money,
        recipient: Option<StaffMemberId>,
    ) -> Self {
        let applied = subtotal.apply_rate(rate / Decimal::new(100, 0));
        Self {
            tip_type: TipType::Percentage(rate),
            computed_amount: applied,
            recipient,
        }
    }

    /// Stores a flat amount tip.
    #[must_use]
    pub fn from_flat(
        amount: Money,
        recipient: Option<StaffMemberId>,
    ) -> Self {
        Self {
            tip_type: TipType::Flat(amount.clone()),
            computed_amount: amount,
            recipient,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;

    #[test]
    fn test_tip_percentage() {
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let tip = TipAmount::from_percentage(Decimal::new(15, 0), &subtotal, None);
        assert_eq!(tip.computed_amount.amount, Decimal::new(150, 0));
    }

    #[test]
    fn test_tip_flat() {
        let flat = Money { amount: Decimal::new(200, 0), currency: Currency::Inr };
        let tip = TipAmount::from_flat(flat, None);
        assert_eq!(tip.computed_amount.amount, Decimal::new(200, 0));
    }
}
