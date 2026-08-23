use crate::ids::StaffMemberId;
use crate::value_objects::money::Money;
use rust_decimal::Decimal;
use thiserror::Error;

/// Type of discount applied
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiscountType {
    /// Percentage discount (0 to 100)
    Percentage(Decimal),
    /// Flat amount discount
    FlatAmount(Money),
}

/// Reason for applying a discount
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiscountReason {
    /// Complementary by manager
    ManagerComp,
    /// Happy hour promotional price
    HappyHour,
    /// Loyalty program reward
    LoyaltyReward,
    /// Apology for a complaint
    CustomerComplaint,
    /// Staff member meal
    StaffMeal,
    /// Custom reason text
    Custom(String),
}

/// Represents a discount applied to an order or item
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Discount {
    /// The calculation method of the discount
    pub discount_type: DiscountType,
    /// The reason the discount was applied
    pub reason: DiscountReason,
    /// Optional staff member ID who authorized this discount
    pub authorized_by: Option<StaffMemberId>,
}

/// Errors that can occur when computing discounts
#[derive(Error, Debug, PartialEq, Eq)]
pub enum DiscountError {
    /// The percentage value provided is out of valid bounds (0-100)
    #[error("Invalid percentage, must be between 0 and 100")]
    InvalidPercentage,
    /// The flat discount exceeds the item's subtotal
    #[error("Flat discount amount exceeds subtotal")]
    ExceedsSubtotal,
    /// Money error from currency mismatch
    #[error("Currency mismatch")]
    MoneyError,
}

impl Discount {
    /// Computes the absolute discount amount based on the subtotal.
    ///
    /// # Errors
    /// Returns `DiscountError::InvalidPercentage` if percentage is out of bounds.
    /// Returns `DiscountError::MoneyError` if currencies mismatch.
    /// Returns `DiscountError::ExceedsSubtotal` if flat discount is larger than subtotal.
    pub fn compute_amount(&self, subtotal: &Money) -> Result<Money, DiscountError> {
        match &self.discount_type {
            DiscountType::Percentage(p) => {
                if *p < Decimal::ZERO || *p > Decimal::new(100, 0) {
                    return Err(DiscountError::InvalidPercentage);
                }
                let rate = *p / Decimal::new(100, 0);
                Ok(subtotal.apply_rate(rate))
            }
            DiscountType::FlatAmount(flat) => {
                if flat.currency != subtotal.currency {
                    return Err(DiscountError::MoneyError);
                }
                if flat.amount > subtotal.amount {
                    return Err(DiscountError::ExceedsSubtotal);
                }
                Ok(flat.clone())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;

    #[test]
    fn test_compute_percentage() {
        let discount = Discount {
            discount_type: DiscountType::Percentage(Decimal::new(10, 0)),
            reason: DiscountReason::ManagerComp,
            authorized_by: None,
        };
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let amount = discount.compute_amount(&subtotal).unwrap();
        assert_eq!(amount.amount, Decimal::new(100, 0));
    }

    #[test]
    fn test_compute_flat() {
        let flat = Money { amount: Decimal::new(50, 0), currency: Currency::Inr };
        let discount = Discount {
            discount_type: DiscountType::FlatAmount(flat),
            reason: DiscountReason::ManagerComp,
            authorized_by: None,
        };
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let amount = discount.compute_amount(&subtotal).unwrap();
        assert_eq!(amount.amount, Decimal::new(50, 0));
    }

    #[test]
    fn test_exceeds_subtotal() {
        let flat = Money { amount: Decimal::new(1500, 0), currency: Currency::Inr };
        let discount = Discount {
            discount_type: DiscountType::FlatAmount(flat),
            reason: DiscountReason::ManagerComp,
            authorized_by: None,
        };
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let err = discount.compute_amount(&subtotal).unwrap_err();
        assert_eq!(err, DiscountError::ExceedsSubtotal);
    }
}
