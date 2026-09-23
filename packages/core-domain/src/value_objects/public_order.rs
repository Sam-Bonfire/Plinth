#![forbid(unsafe_code)]

use crate::enums::order_channel::OrderChannel;
use crate::value_objects::money::{Currency, Money};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// A public (unauthenticated) order line awaiting validation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicOrderLine {
    /// Menu item reference.
    pub menu_item_id: String,
    /// Item name at order time.
    pub name: String,
    /// Unit price in minor units.
    pub unit_price_minor: i64,
    /// Ordered quantity.
    pub quantity: i64,
}

/// Attribution for a public order: where it came from and who sent it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicOrderAttribution {
    /// Aggregator or entry channel.
    pub channel: OrderChannel,
    /// Claimed actor (unverified for public intake).
    pub created_by: String,
}

/// Errors violating public order invariants.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum PublicOrderError {
    /// No line items present.
    #[error("Order needs at least one item")]
    EmptyOrder,
    /// Quantity is not positive.
    #[error("Invalid quantity for {0}")]
    InvalidQuantity(String),
    /// Price is negative.
    #[error("Invalid price for {0}")]
    InvalidPrice(String),
    /// Arithmetic overflow.
    #[error("Order total overflows")]
    TotalOverflow,
}

/// Validated totals for a public order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicOrderTotals {
    /// Grand total in minor units.
    pub total_minor: i64,
    /// Total item count.
    pub item_count: i64,
}

/// Validates public order lines, returning totals.
///
/// # Errors
/// Returns [`PublicOrderError`] when any invariant fails.
pub fn validate_public_order(lines: &[PublicOrderLine]) -> Result<PublicOrderTotals, PublicOrderError> {
    if lines.is_empty() {
        return Err(PublicOrderError::EmptyOrder);
    }
    let mut total_minor: i64 = 0;
    let mut item_count: i64 = 0;
    for line in lines {
        if line.quantity < 1 {
            return Err(PublicOrderError::InvalidQuantity(line.name.clone()));
        }
        if line.unit_price_minor < 0 {
            return Err(PublicOrderError::InvalidPrice(line.name.clone()));
        }
        total_minor = total_minor
            .checked_add(line.unit_price_minor.checked_mul(line.quantity).ok_or(PublicOrderError::TotalOverflow)?)
            .ok_or(PublicOrderError::TotalOverflow)?;
        item_count = item_count
            .checked_add(line.quantity)
            .ok_or(PublicOrderError::TotalOverflow)?;
    }
    Ok(PublicOrderTotals {
        total_minor,
        item_count,
    })
}

/// Converts validated minor-unit totals into [`Money`].
#[must_use]
pub fn totals_to_money(totals: &PublicOrderTotals, currency: Currency) -> Money {
    Money {
        amount: Decimal::from(totals.total_minor) / Decimal::from(currency.minor_unit_scale()),
        currency,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(name: &str, price: i64, qty: i64) -> PublicOrderLine {
        PublicOrderLine {
            menu_item_id: "mi-1".to_string(),
            name: name.to_string(),
            unit_price_minor: price,
            quantity: qty,
        }
    }

    #[test]
    fn totals_lines() {
        let totals = validate_public_order(&[line("Burger", 20000, 2)]).expect("valid");
        assert_eq!(totals.total_minor, 40000);
        assert_eq!(totals.item_count, 2);
    }

    #[test]
    fn rejects_empty_zero_and_negative() {
        assert_eq!(validate_public_order(&[]), Err(PublicOrderError::EmptyOrder));
        assert_eq!(
            validate_public_order(&[line("Burger", 20000, 0)]),
            Err(PublicOrderError::InvalidQuantity("Burger".to_string()))
        );
        assert_eq!(
            validate_public_order(&[line("Burger", -5, 1)]),
            Err(PublicOrderError::InvalidPrice("Burger".to_string()))
        );
    }

    #[test]
    fn rejects_overflow() {
        assert_eq!(
            validate_public_order(&[line("Burger", i64::MAX, 2)]),
            Err(PublicOrderError::TotalOverflow)
        );
    }

    #[test]
    fn converts_to_money() {
        let totals = PublicOrderTotals {
            total_minor: 40000,
            item_count: 2,
        };
        let money = totals_to_money(&totals, Currency::Inr);
        assert_eq!(money.amount, Decimal::new(400, 0));
    }

    #[test]
    fn attribution_round_trips() {
        let attribution = PublicOrderAttribution {
            channel: OrderChannel::Swiggy,
            created_by: "public-api".to_string(),
        };
        let json = serde_json::to_string(&attribution).expect("serialize");
        let back: PublicOrderAttribution = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back, attribution);
    }
}
