use crate::value_objects::money::Money;
use rust_decimal::Decimal;

use serde::{Deserialize, Serialize};

/// Types of standard order charges
#[non_exhaustive]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum ChargeType {
    /// Discretionary or mandatory service charge
    ServiceCharge,
    /// Charge for take-away packaging
    PackagingCharge,
    /// Charge for delivery logistics
    DeliveryCharge,
    /// Custom textual charge
    Custom(String),
}

/// Represents an extra charge applied to an order
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct OrderCharge {
    /// Classification of the charge
    pub charge_type: ChargeType,
    /// Rate as a percentage (e.g., `Decimal::new(10, 0)` for 10%) or None for flat charges
    #[specta(type = Option<String>)]
    pub rate: Option<Decimal>,
    /// The computed monetary amount
    pub amount: Money,
    /// Whether GST applies on this charge
    pub taxable: bool,
}

impl OrderCharge {
    /// Creates a percentage-based charge.
    #[must_use]
    pub fn from_percentage(
        charge_type: ChargeType,
        rate: Decimal,
        subtotal: &Money,
        taxable: bool,
    ) -> Self {
        let applied = subtotal.apply_rate(rate / Decimal::new(100, 0));
        Self {
            charge_type,
            rate: Some(rate),
            amount: applied,
            taxable,
        }
    }

    /// Creates a flat-amount charge.
    #[must_use]
    pub fn from_flat(
        charge_type: ChargeType,
        amount: Money,
        taxable: bool,
    ) -> Self {
        Self {
            charge_type,
            rate: None,
            amount,
            taxable,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;

    #[test]
    fn test_order_charge_percentage() {
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let charge = OrderCharge::from_percentage(ChargeType::ServiceCharge, Decimal::new(10, 0), &subtotal, true);
        assert_eq!(charge.amount.amount, Decimal::new(100, 0));
        assert_eq!(charge.rate, Some(Decimal::new(10, 0)));
    }

    #[test]
    fn test_order_charge_flat() {
        let flat = Money { amount: Decimal::new(30, 0), currency: Currency::Inr };
        let charge = OrderCharge::from_flat(ChargeType::PackagingCharge, flat, false);
        assert_eq!(charge.amount.amount, Decimal::new(30, 0));
        assert_eq!(charge.rate, None);
    }
}
