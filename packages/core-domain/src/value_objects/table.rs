use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Specific seat identifier on a table
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[specta(transparent)]
pub struct SeatNumber(u16);

/// Details of a restaurant floor section
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct FloorSection {
    /// Name of the section (e.g. "Patio")
    pub name: String,
    /// Visual ordering priority
    pub display_order: u16,
}

/// Floor table related errors
#[derive(Error, Debug, PartialEq, Eq)]
pub enum TableError {
    /// Seat number was invalid (e.g. zero)
    #[error("Invalid seat number, must be at least 1")]
    InvalidSeatNumber,
}

impl SeatNumber {
    /// Creates a new `SeatNumber`.
    ///
    /// # Errors
    /// Returns `TableError::InvalidSeatNumber` if the seat number is 0.
    pub fn new(n: u16) -> Result<Self, TableError> {
        if n == 0 {
            return Err(TableError::InvalidSeatNumber);
        }
        Ok(Self(n))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seat_number() {
        assert!(SeatNumber::new(1).is_ok());
        assert_eq!(SeatNumber::new(0).unwrap_err(), TableError::InvalidSeatNumber);
    }
}
