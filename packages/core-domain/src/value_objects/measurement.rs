use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Units of measure for stock management
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum UnitOfMeasure {
    /// Kilograms
    Kilogram,
    /// Grams
    Gram,
    /// Litres
    Litre,
    /// Millilitres
    Millilitre,
    /// Distinct items/pieces
    Piece,
}

/// Represents an amount of stock
#[derive(Debug, Clone, PartialEq, Eq)]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct StockQuantity {
    /// The numeric magnitude
    pub value: Decimal,
    /// The unit it is measured in
    pub unit: UnitOfMeasure,
}

/// Measurement validation and arithmetic errors
#[derive(Error, Debug, PartialEq, Eq)]
pub enum MeasurementError {
    /// Quantity provided was below zero
    #[error("Stock quantity cannot be negative")]
    NegativeQuantity,
    /// Attempted operation across incompatible units
    #[error("Unit mismatch")]
    UnitMismatch,
}

impl StockQuantity {
    /// Creates a validated stock quantity.
    ///
    /// # Errors
    /// Returns `MeasurementError::NegativeQuantity` if the value is negative.
    pub fn new(value: Decimal, unit: UnitOfMeasure) -> Result<Self, MeasurementError> {
        if value.is_sign_negative() {
            return Err(MeasurementError::NegativeQuantity);
        }
        Ok(Self { value, unit })
    }

    /// Creates a zero quantity of the specified unit.
    #[must_use]
    pub fn zero(unit: UnitOfMeasure) -> Self {
        Self {
            value: Decimal::ZERO,
            unit,
        }
    }

    /// Adds two compatible stock quantities.
    ///
    /// # Errors
    /// Returns `MeasurementError::UnitMismatch` if units don't match.
    pub fn add(&self, other: &StockQuantity) -> Result<Self, MeasurementError> {
        if self.unit != other.unit {
            return Err(MeasurementError::UnitMismatch);
        }
        Ok(Self {
            value: self.value + other.value,
            unit: self.unit,
        })
    }

    /// Subtracts a compatible stock quantity.
    ///
    /// # Errors
    /// Returns `MeasurementError::UnitMismatch` if units don't match.
    /// Returns `MeasurementError::NegativeQuantity` if result would be negative.
    pub fn sub(&self, other: &StockQuantity) -> Result<Self, MeasurementError> {
        if self.unit != other.unit {
            return Err(MeasurementError::UnitMismatch);
        }
        let new_val = self.value - other.value;
        if new_val.is_sign_negative() {
            return Err(MeasurementError::NegativeQuantity);
        }
        Ok(Self {
            value: new_val,
            unit: self.unit,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quantity_creation() {
        assert!(StockQuantity::new(Decimal::new(10, 0), UnitOfMeasure::Kilogram).is_ok());
        assert_eq!(StockQuantity::new(Decimal::new(-1, 0), UnitOfMeasure::Piece).unwrap_err(), MeasurementError::NegativeQuantity);
    }
}
