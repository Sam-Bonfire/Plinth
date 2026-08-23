use crate::ids::{LocationId, TenantId};
use crate::value_objects::money::{Currency, Money};
use crate::value_objects::tax::GstApplicability;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Store location specific operational configuration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocationConfig {
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Location identifier
    pub location_id: LocationId,
    /// Human readable name of the location
    pub name: String,
    /// IANA timezone string (e.g. "Asia/Kolkata")
    pub timezone_iana: String,
    /// Operating currency
    pub currency: Currency,
    /// Applicable GST regime
    pub tax_applicability: GstApplicability,
    /// Optional default service charge percentage
    pub service_charge_percentage: Option<Decimal>,
    /// Optional default packaging charge for takeaway/delivery
    pub packaging_charge_default: Option<Money>,
    /// Whether tipping is enabled at this store
    pub tips_enabled: bool,
}

#[cfg(test)]
mod tests {
    use crate::ids::{LocationId, TenantId};
    use crate::models::location_config::LocationConfig;
    use crate::value_objects::money::{Currency, Money};
    use crate::value_objects::tax::GstApplicability;
    use rust_decimal::Decimal;

    #[test]
    fn test_location_config() {
        let config = LocationConfig {
            tenant_id: TenantId::new(),
            location_id: LocationId::new(),
            name: "Indiranagar Flagship".to_string(),
            timezone_iana: "Asia/Kolkata".to_string(),
            currency: Currency::Inr,
            tax_applicability: GstApplicability::IntraState,
            service_charge_percentage: Some(Decimal::new(5, 0)),
            packaging_charge_default: Some(Money {
                amount: Decimal::new(25, 0),
                currency: Currency::Inr,
            }),
            tips_enabled: true,
        };
        assert_eq!(config.name, "Indiranagar Flagship");
        assert!(config.tips_enabled);
    }
}
