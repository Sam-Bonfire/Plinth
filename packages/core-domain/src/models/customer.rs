use crate::ids::{CustomerId, LocationId, TenantId};
use crate::value_objects::money::{Currency, Money};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors violating customer identity invariants.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CustomerError {
    /// Name is empty after trimming.
    #[error("Customer name must not be empty")]
    EmptyName,
    /// Phone has no 7-15 digits after stripping formatting.
    #[error("Customer phone must contain 7-15 digits")]
    InvalidPhone,
    /// Email lacks required shape.
    #[error("Customer email is malformed")]
    InvalidEmail,
    /// Visit spend is negative.
    #[error("Visit spend must not be negative")]
    NegativeSpend,
    /// Currency of a visit differs from the customer's currency.
    #[error("Visit currency differs from customer currency")]
    CurrencyMismatch,
}

/// Loyalty tier. Promotion thresholds live in tier-promotion logic;
/// this enum only labels the current tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum CustomerTier {
    Regular,
    Silver,
    Gold,
}

/// Customer identity aggregate root.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct Customer {
    /// Customer ID
    pub id: CustomerId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Home outlet location identifier
    pub location_id: LocationId,
    /// Full name
    pub name: String,
    /// Normalized phone (digits with optional leading `+`)
    pub phone: String,
    /// Optional email
    pub email: Option<String>,
    /// Loyalty tier
    pub tier: CustomerTier,
    /// Completed visit count
    pub visits: u32,
    /// Lifetime spend
    pub total_spend: Money,
    /// Whether the profile is active
    pub is_active: bool,
}

fn normalize_phone(raw: &str) -> Option<String> {
    let stripped: String = raw
        .chars()
        .filter(|c| *c != ' ' && *c != '-' && *c != '(' && *c != ')')
        .collect();
    let digits = stripped.strip_prefix('+').unwrap_or(&stripped);
    if !digits.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    if !(7..=15).contains(&digits.len()) {
        return None;
    }
    Some(stripped)
}

fn valid_email(raw: &str) -> bool {
    let parts: Vec<&str> = raw.split('@').collect();
    if parts.len() != 2 || parts[0].is_empty() {
        return false;
    }
    parts[1].contains('.') && !parts[1].starts_with('.') && !parts[1].ends_with('.')
}

impl Customer {
    /// Creates a new active `Regular` customer, enforcing identity invariants.
    ///
    /// # Errors
    /// Returns [`CustomerError`] if the name, phone, or email is invalid.
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        name: &str,
        phone: &str,
        email: Option<String>,
        currency: Currency,
    ) -> Result<Self, CustomerError> {
        if name.trim().is_empty() {
            return Err(CustomerError::EmptyName);
        }
        let phone = normalize_phone(phone).ok_or(CustomerError::InvalidPhone)?;
        if let Some(ref e) = email {
            if !valid_email(e) {
                return Err(CustomerError::InvalidEmail);
            }
        }
        Ok(Self {
            id: CustomerId::new(),
            tenant_id,
            location_id,
            name: name.trim().to_string(),
            phone,
            email,
            tier: CustomerTier::Regular,
            visits: 0,
            total_spend: Money::zero(currency),
            is_active: true,
        })
    }

    /// Records one completed visit, accumulating spend. Totals only grow.
    ///
    /// # Errors
    /// Returns [`CustomerError`] if the spend is negative or currency differs.
    pub fn record_visit(&mut self, spend: &Money) -> Result<(), CustomerError> {
        if spend.amount < Decimal::ZERO {
            return Err(CustomerError::NegativeSpend);
        }
        if spend.currency != self.total_spend.currency {
            return Err(CustomerError::CurrencyMismatch);
        }
        self.visits += 1;
        self.total_spend = Money {
            amount: self.total_spend.amount + spend.amount,
            currency: self.total_spend.currency,
        };
        Ok(())
    }

    /// Deactivates the profile. Identity data is retained for audit.
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;

    fn customer() -> Customer {
        Customer::new(
            TenantId::new(),
            LocationId::new(),
            "Asha Rao",
            "+91 98200 12345",
            Some("asha@example.com".to_string()),
            Currency::Inr,
        )
        .expect("valid customer")
    }

    #[test]
    fn creates_regular_customer_with_normalized_phone() {
        let c = customer();
        assert_eq!(c.tier, CustomerTier::Regular);
        assert_eq!(c.phone, "+919820012345");
        assert!(c.is_active);
        assert_eq!(c.visits, 0);
    }

    #[test]
    fn rejects_empty_name() {
        let r = Customer::new(
            TenantId::new(),
            LocationId::new(),
            "   ",
            "9820012345",
            None,
            Currency::Inr,
        );
        assert_eq!(r, Err(CustomerError::EmptyName));
    }

    #[test]
    fn rejects_bad_phones() {
        for bad in ["123", "abcdefghij", "+91-98A001234", ""] {
            let r = Customer::new(
                TenantId::new(),
                LocationId::new(),
                "Asha",
                bad,
                None,
                Currency::Inr,
            );
            assert_eq!(r, Err(CustomerError::InvalidPhone), "phone: {bad}");
        }
    }

    #[test]
    fn rejects_malformed_email() {
        for bad in ["no-at-sign", "a@b", "a@.com", "@x.com", "a@@b.com"] {
            let r = Customer::new(
                TenantId::new(),
                LocationId::new(),
                "Asha",
                "9820012345",
                Some(bad.to_string()),
                Currency::Inr,
            );
            assert_eq!(r, Err(CustomerError::InvalidEmail), "email: {bad}");
        }
    }

    #[test]
    fn visits_accumulate_monotonically() {
        let mut c = customer();
        let spend = Money {
            amount: Decimal::new(500, 0),
            currency: Currency::Inr,
        };
        c.record_visit(&spend).unwrap();
        c.record_visit(&spend).unwrap();
        assert_eq!(c.visits, 2);
        assert_eq!(c.total_spend.amount, Decimal::new(1000, 0));
    }

    #[test]
    fn rejects_negative_spend() {
        let mut c = customer();
        let bad = Money {
            amount: Decimal::new(-10, 0),
            currency: Currency::Inr,
        };
        assert_eq!(c.record_visit(&bad), Err(CustomerError::NegativeSpend));
        assert_eq!(c.visits, 0);
    }

    #[test]
    fn deactivation_retains_identity() {
        let mut c = customer();
        c.deactivate();
        assert!(!c.is_active);
        assert_eq!(c.name, "Asha Rao");
    }
}
