use crate::value_objects::money::Money;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Result of computing tax on a subtotal
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaxBreakdown {
    /// The total calculated tax
    pub total_tax: Money,
    /// Granular tax components
    pub components: Vec<TaxComponent>,
}

/// A single component of applied tax
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaxComponent {
    /// The label of the tax (e.g. CGST 9%)
    pub label: String,
    /// The applicable rate
    pub rate: Decimal,
    /// The tax monetary amount
    pub amount: Money,
}

/// Indian GST rate slabs
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GstRate {
    /// 0% Tax
    Exempt,
    /// 5% Tax
    FivePercent,
    /// 12% Tax
    TwelvePercent,
    /// 18% Tax
    EighteenPercent,
    /// 28% Tax
    TwentyEightPercent,
}

impl GstRate {
    /// Returns the decimal representation of the GST rate.
    #[must_use]
    pub fn rate_decimal(&self) -> Decimal {
        match self {
            Self::Exempt => Decimal::ZERO,
            Self::FivePercent => Decimal::new(5, 2),
            Self::TwelvePercent => Decimal::new(12, 2),
            Self::EighteenPercent => Decimal::new(18, 2),
            Self::TwentyEightPercent => Decimal::new(28, 2),
        }
    }
}

/// Whether GST is intra-state (CGST+SGST) or inter-state (IGST)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GstApplicability {
    /// Intra-state transaction attracting CGST + SGST
    IntraState,
    /// Inter-state transaction attracting IGST
    InterState,
}

/// Computes the GST breakdown for a given subtotal
#[must_use]
pub fn compute_gst(
    subtotal: &Money,
    rate: &GstRate,
    applicability: &GstApplicability,
) -> TaxBreakdown {
    let decimal_rate = rate.rate_decimal();
    
    if decimal_rate.is_zero() {
        return TaxBreakdown {
            total_tax: Money::zero(subtotal.currency),
            components: vec![],
        };
    }

    match applicability {
        GstApplicability::IntraState => {
            let half_rate = decimal_rate / Decimal::new(2, 0);
            let half_tax = subtotal.apply_rate(half_rate);
            
            let cgst = TaxComponent {
                label: format!("CGST {}%", half_rate * Decimal::new(100, 0)),
                rate: half_rate,
                amount: half_tax.clone(),
            };
            
            let sgst = TaxComponent {
                label: format!("SGST {}%", half_rate * Decimal::new(100, 0)),
                rate: half_rate,
                amount: half_tax.clone(),
            };

            let total_tax = cgst.amount.add(&sgst.amount).unwrap_or(Money::zero(subtotal.currency));

            TaxBreakdown {
                total_tax,
                components: vec![cgst, sgst],
            }
        }
        GstApplicability::InterState => {
            let igst_tax = subtotal.apply_rate(decimal_rate);
            
            let igst = TaxComponent {
                label: format!("IGST {}%", decimal_rate * Decimal::new(100, 0)),
                rate: decimal_rate,
                amount: igst_tax.clone(),
            };

            TaxBreakdown {
                total_tax: igst_tax,
                components: vec![igst],
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;

    #[test]
    fn test_compute_gst_intra() {
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let breakdown = compute_gst(&subtotal, &GstRate::EighteenPercent, &GstApplicability::IntraState);
        assert_eq!(breakdown.total_tax.amount, Decimal::new(180, 0));
        assert_eq!(breakdown.components.len(), 2);
        assert_eq!(breakdown.components[0].amount.amount, Decimal::new(90, 0));
        assert_eq!(breakdown.components[1].amount.amount, Decimal::new(90, 0));
    }

    #[test]
    fn test_compute_gst_inter() {
        let subtotal = Money { amount: Decimal::new(500, 0), currency: Currency::Inr };
        let breakdown = compute_gst(&subtotal, &GstRate::FivePercent, &GstApplicability::InterState);
        assert_eq!(breakdown.total_tax.amount, Decimal::new(25, 0));
        assert_eq!(breakdown.components.len(), 1);
        assert_eq!(breakdown.components[0].amount.amount, Decimal::new(25, 0));
    }

    #[test]
    fn test_compute_gst_exempt() {
        let subtotal = Money { amount: Decimal::new(1000, 0), currency: Currency::Inr };
        let breakdown = compute_gst(&subtotal, &GstRate::Exempt, &GstApplicability::IntraState);
        assert_eq!(breakdown.total_tax.amount, Decimal::new(0, 0));
        assert!(breakdown.components.is_empty());
    }
}
