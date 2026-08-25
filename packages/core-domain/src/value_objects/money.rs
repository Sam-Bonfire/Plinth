use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use thiserror::Error;

/// Supported currencies. Non-exhaustive for future expansion.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Currency {
    /// Indian Rupee
    Inr,
}

impl Currency {
    /// Returns the currency symbol.
    #[must_use]
    pub fn symbol(&self) -> &'static str {
        match self {
            Self::Inr => "₹",
        }
    }

    /// Returns the standard currency code.
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::Inr => "INR",
        }
    }

    /// Returns the minor unit scale (e.g., 100 for INR).
    #[must_use]
    pub fn minor_unit_scale(&self) -> i64 {
        match self {
            Self::Inr => 100,
        }
    }
}

/// Represents a monetary value in a specific currency.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    /// The decimal amount
    pub amount: Decimal,
    /// The currency of the amount
    pub currency: Currency,
}

/// Errors that can occur during monetary operations.
#[derive(Error, Debug, PartialEq, Eq)]
pub enum MoneyError {
    /// Occurs when attempting to operate on Money values of different currencies.
    #[error("Currency mismatch: expected {expected:?}, got {got:?}")]
    CurrencyMismatch {
        /// The expected currency
        expected: Currency,
        /// The actual currency provided
        got: Currency
    },
}

impl Money {
    /// Creates a new zero Money value in the specified currency.
    #[must_use]
    pub fn zero(currency: Currency) -> Self {
        Self {
            amount: Decimal::ZERO,
            currency,
        }
    }

    /// Adds another Money value to this one.
    ///
    /// # Errors
    /// Returns `MoneyError::CurrencyMismatch` if currencies do not match.
    pub fn add(&self, other: &Money) -> Result<Money, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch {
                expected: self.currency,
                got: other.currency,
            });
        }
        Ok(Money {
            amount: self.amount + other.amount,
            currency: self.currency,
        })
    }

    /// Subtracts another Money value from this one.
    ///
    /// # Errors
    /// Returns `MoneyError::CurrencyMismatch` if currencies do not match.
    pub fn sub(&self, other: &Money) -> Result<Money, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch {
                expected: self.currency,
                got: other.currency,
            });
        }
        Ok(Money {
            amount: self.amount - other.amount,
            currency: self.currency,
        })
    }

    /// Multiplies the monetary amount by a quantity.
    #[must_use]
    pub fn mul_quantity(&self, qty: u32) -> Money {
        Money {
            amount: self.amount * Decimal::from(qty),
            currency: self.currency,
        }
    }

    /// Applies a rate (e.g., percentage) to the monetary amount.
    #[must_use]
    pub fn apply_rate(&self, rate: Decimal) -> Money {
        Money {
            amount: self.amount * rate,
            currency: self.currency,
        }
    }

    /// Negates the monetary amount.
    #[must_use]
    pub fn negate(&self) -> Money {
        Money {
            amount: -self.amount,
            currency: self.currency,
        }
    }

    /// Returns true if the amount is exactly zero.
    #[must_use]
    pub fn is_zero(&self) -> bool {
        self.amount.is_zero()
    }

    /// Returns true if the amount is negative.
    #[must_use]
    pub fn is_negative(&self) -> bool {
        self.amount.is_sign_negative() && !self.amount.is_zero()
    }

    /// Returns true if the amount is positive.
    #[must_use]
    pub fn is_positive(&self) -> bool {
        self.amount.is_sign_positive() && !self.amount.is_zero()
    }

    /// Serializes the money amount to minor units (e.g., cents or paise) based on currency scale.
    #[must_use]
    pub fn to_minor_units(&self) -> i64 {
        let scale = Decimal::from(self.currency.minor_unit_scale());
        let minor = (self.amount * scale).round();
        minor.to_string().parse::<i64>().unwrap_or(0)
    }

    /// Deserializes a money amount from minor units given the currency.
    #[must_use]
    pub fn from_minor_units(cents: i64, currency: Currency) -> Self {
        let scale = Decimal::from(currency.minor_unit_scale());
        Self {
            amount: Decimal::from(cents) / scale,
            currency,
        }
    }
}

impl std::fmt::Display for Money {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}{:.2}", self.currency.symbol(), self.amount)
    }
}

impl PartialOrd for Money {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Money {
    fn cmp(&self, other: &Self) -> Ordering {
        assert!(self.currency == other.currency, "Cannot compare money with different currencies");
        self.amount.cmp(&other.amount)
    }
}

impl std::ops::Add for Money {
    type Output = Money;
    fn add(self, rhs: Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot add money with different currencies");
        Money {
            amount: self.amount + rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::ops::Add<&Money> for Money {
    type Output = Money;
    fn add(self, rhs: &Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot add money with different currencies");
        Money {
            amount: self.amount + rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::ops::Add for &Money {
    type Output = Money;
    fn add(self, rhs: &Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot add money with different currencies");
        Money {
            amount: self.amount + rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::ops::Sub for Money {
    type Output = Money;
    fn sub(self, rhs: Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot subtract money with different currencies");
        Money {
            amount: self.amount - rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::ops::Sub<&Money> for Money {
    type Output = Money;
    fn sub(self, rhs: &Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot subtract money with different currencies");
        Money {
            amount: self.amount - rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::ops::Sub for &Money {
    type Output = Money;
    fn sub(self, rhs: &Money) -> Self::Output {
        assert!(self.currency == rhs.currency, "Cannot subtract money with different currencies");
        Money {
            amount: self.amount - rhs.amount,
            currency: self.currency,
        }
    }
}

impl std::iter::Sum for Money {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Money::zero(Currency::Inr), |acc, m| acc + m)
    }
}

impl<'a> std::iter::Sum<&'a Money> for Money {
    fn sum<I: Iterator<Item = &'a Money>>(iter: I) -> Self {
        iter.fold(Money::zero(Currency::Inr), |acc, m| acc + m)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_money_arithmetic() {
        let m1 = Money { amount: Decimal::new(100, 0), currency: Currency::Inr };
        let m2 = Money { amount: Decimal::new(50, 0), currency: Currency::Inr };
        let sum = m1.add(&m2).unwrap();
        assert_eq!(sum.amount, Decimal::new(150, 0));
    }

    #[test]
    fn test_minor_units() {
        let m = Money { amount: Decimal::new(54050, 2), currency: Currency::Inr };
        let cents = m.to_minor_units();
        assert_eq!(cents, 54050);
        
        let m2 = Money::from_minor_units(54050, Currency::Inr);
        assert_eq!(m.amount, m2.amount);
    }

    #[test]
    fn test_display() {
        let m = Money { amount: Decimal::new(540, 0), currency: Currency::Inr };
        assert_eq!(m.to_string(), "₹540.00");
    }
}
