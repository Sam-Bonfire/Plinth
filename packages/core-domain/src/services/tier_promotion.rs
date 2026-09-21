#![forbid(unsafe_code)]

use crate::models::customer::CustomerTier;
use crate::value_objects::money::Money;

/// Visits needed for Silver.
pub const SILVER_VISITS: u32 = 10;
/// Lifetime spend (major units) needed for Silver.
pub const SILVER_SPEND_MAJOR: i64 = 5_000;
/// Visits needed for Gold.
pub const GOLD_VISITS: u32 = 25;
/// Lifetime spend (major units) needed for Gold.
pub const GOLD_SPEND_MAJOR: i64 = 20_000;

/// Evaluates the tier a customer qualifies for. Never demotes below `current`.
///
/// Silver needs `SILVER_VISITS` visits or `SILVER_SPEND_MAJOR` lifetime spend.
/// Gold needs `GOLD_VISITS` visits and `GOLD_SPEND_MAJOR` lifetime spend.
#[must_use]
pub fn evaluate_tier(current: CustomerTier, visits: u32, lifetime_spend: &Money) -> CustomerTier {
    let spend = lifetime_spend.amount;
    let qualifies_gold = visits >= GOLD_VISITS
        && spend >= rust_decimal::Decimal::from(GOLD_SPEND_MAJOR);
    let qualifies_silver = visits >= SILVER_VISITS
        || spend >= rust_decimal::Decimal::from(SILVER_SPEND_MAJOR);
    let earned = if qualifies_gold {
        CustomerTier::Gold
    } else if qualifies_silver {
        CustomerTier::Silver
    } else {
        CustomerTier::Regular
    };
    match (current, earned) {
        (CustomerTier::Gold, _) | (_, CustomerTier::Gold) => CustomerTier::Gold,
        (CustomerTier::Silver, CustomerTier::Regular) => CustomerTier::Silver,
        (_, earned) => earned,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;
    use rust_decimal::Decimal;

    fn spend(major: i64) -> Money {
        Money {
            amount: Decimal::from(major),
            currency: Currency::Inr,
        }
    }

    #[test]
    fn regular_stays_regular_below_thresholds() {
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 3, &spend(1_000)),
            CustomerTier::Regular
        );
    }

    #[test]
    fn visits_earn_silver() {
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 10, &spend(0)),
            CustomerTier::Silver
        );
    }

    #[test]
    fn spend_earns_silver() {
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 0, &spend(5_000)),
            CustomerTier::Silver
        );
    }

    #[test]
    fn gold_needs_visits_and_spend() {
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 30, &spend(1_000)),
            CustomerTier::Silver,
            "visits alone cannot earn gold"
        );
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 0, &spend(50_000)),
            CustomerTier::Silver,
            "spend alone cannot earn gold"
        );
        assert_eq!(
            evaluate_tier(CustomerTier::Regular, 25, &spend(20_000)),
            CustomerTier::Gold
        );
    }

    #[test]
    fn never_demotes() {
        assert_eq!(
            evaluate_tier(CustomerTier::Gold, 0, &spend(0)),
            CustomerTier::Gold
        );
        assert_eq!(
            evaluate_tier(CustomerTier::Silver, 0, &spend(0)),
            CustomerTier::Silver
        );
    }

    #[test]
    fn silver_upgrades_to_gold() {
        assert_eq!(
            evaluate_tier(CustomerTier::Silver, 25, &spend(20_000)),
            CustomerTier::Gold
        );
    }
}
