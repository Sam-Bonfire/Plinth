use crate::value_objects::money::Money;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A time-bound price listing
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PricingVersion {
    /// The charged monetary amount
    pub price: Money,
    /// Point in time when price becomes active
    pub effective_from: DateTime<Utc>,
    /// Point in time when price expires
    pub effective_until: Option<DateTime<Utc>>,
}

impl PricingVersion {
    /// Checks if this pricing applies at the given timestamp.
    #[must_use]
    pub fn is_active_at(&self, at: DateTime<Utc>) -> bool {
        if at < self.effective_from {
            return false;
        }
        if let Some(until) = self.effective_until {
            if at >= until {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;
    use rust_decimal::Decimal;
    use chrono::TimeZone;

    #[test]
    fn test_pricing_version() {
        let price = Money { amount: Decimal::new(100, 0), currency: Currency::Inr };
        let t1 = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let t2 = Utc.with_ymd_and_hms(2023, 12, 31, 23, 59, 59).unwrap();
        
        let pv = PricingVersion {
            price: price.clone(),
            effective_from: t1,
            effective_until: Some(t2),
        };

        let before = Utc.with_ymd_and_hms(2022, 12, 31, 0, 0, 0).unwrap();
        let active = Utc.with_ymd_and_hms(2023, 6, 1, 0, 0, 0).unwrap();
        let after = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();

        assert!(!pv.is_active_at(before));
        assert!(pv.is_active_at(active));
        assert!(!pv.is_active_at(after));
    }
}
