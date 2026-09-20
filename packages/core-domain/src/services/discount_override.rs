#![forbid(unsafe_code)]

use crate::enums::staff::{Permissions, StaffRole};
use crate::ids::StaffMemberId;
use crate::models::staff::StaffMember;
use crate::value_objects::discount::{Discount, DiscountType};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Percentages above 20 need Owner/Manager approval.
pub const MANAGER_ONLY_PERCENT_MAJOR: i64 = 20;

/// Errors rejecting a discount override.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum OverrideError {
    /// Approver account is inactive.
    #[error("Approver account is inactive")]
    InactiveApprover,
    /// PIN did not verify.
    #[error("Manager PIN is incorrect")]
    BadPin,
    /// Approver lacks discount permission.
    #[error("Approver lacks discount permission")]
    Forbidden,
    /// Discount exceeds approver's authority.
    #[error("Discount exceeds approver authority; manager required")]
    ManagerRequired,
}

/// Recorded manager override approval.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct DiscountApproval {
    /// Discount that was approved
    pub discount: Discount,
    /// Approver staff ID
    pub approved_by: StaffMemberId,
}

fn requires_manager(discount: &Discount) -> bool {
    match &discount.discount_type {
        DiscountType::Percentage(p) => *p > Decimal::from(MANAGER_ONLY_PERCENT_MAJOR),
        DiscountType::FlatAmount(_) => false,
    }
}

/// Authorizes a discount override via manager PIN.
///
/// Rules: approver active, PIN verifies, approver holds
/// `APPLY_DISCOUNT`, and percentages above `MANAGER_ONLY_PERCENT`
/// need Owner/Manager role.
///
/// # Errors
/// Returns [`OverrideError`] when any rule fails.
pub fn authorize_override(
    approver: &StaffMember,
    pin: &str,
    discount: Discount,
) -> Result<DiscountApproval, OverrideError> {
    if !approver.is_active {
        return Err(OverrideError::InactiveApprover);
    }
    if !approver.verify_pin(pin) {
        return Err(OverrideError::BadPin);
    }
    if !approver.has_permission(Permissions::APPLY_DISCOUNT) {
        return Err(OverrideError::Forbidden);
    }
    if requires_manager(&discount)
        && !matches!(
            approver.role,
            StaffRole::Owner | StaffRole::Manager
        )
    {
        return Err(OverrideError::ManagerRequired);
    }
    Ok(DiscountApproval {
        discount,
        approved_by: approver.id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{LocationId, TenantId};
    use crate::value_objects::discount::{DiscountReason, DiscountType};
    use crate::value_objects::money::{Currency, Money};

    fn approver(role: StaffRole, perms: Permissions, pin: &str, active: bool) -> StaffMember {
        let mut s = StaffMember::new(
            TenantId::new(),
            LocationId::new(),
            "Mina".to_string(),
            role,
            perms,
            pin.to_string(),
        );
        s.is_active = active;
        s
    }

    fn pct(p: i64) -> Discount {
        Discount {
            discount_type: DiscountType::Percentage(Decimal::from(p)),
            reason: DiscountReason::ManagerComp,
            authorized_by: None,
        }
    }

    #[test]
    fn manager_approves_small_discount() {
        let m = approver(
            StaffRole::Manager,
            StaffRole::Manager.default_permissions(),
            "4321",
            true,
        );
        let a = authorize_override(&m, "4321", pct(10)).unwrap();
        assert_eq!(a.approved_by, m.id);
    }

    #[test]
    fn rejects_wrong_pin() {
        let m = approver(
            StaffRole::Manager,
            StaffRole::Manager.default_permissions(),
            "4321",
            true,
        );
        assert_eq!(
            authorize_override(&m, "0000", pct(10)),
            Err(OverrideError::BadPin)
        );
    }

    #[test]
    fn rejects_inactive_approver() {
        let m = approver(
            StaffRole::Manager,
            StaffRole::Manager.default_permissions(),
            "4321",
            false,
        );
        assert_eq!(
            authorize_override(&m, "4321", pct(10)),
            Err(OverrideError::InactiveApprover)
        );
    }

    #[test]
    fn rejects_missing_permission() {
        let w = approver(StaffRole::Waiter, Permissions::empty(), "1111", true);
        assert_eq!(
            authorize_override(&w, "1111", pct(5)),
            Err(OverrideError::Forbidden)
        );
    }

    #[test]
    fn large_percent_needs_manager() {
        let cashier_perms = Permissions::APPLY_DISCOUNT;
        let c = approver(StaffRole::Cashier, cashier_perms, "2222", true);
        assert_eq!(
            authorize_override(&c, "2222", pct(50)),
            Err(OverrideError::ManagerRequired)
        );
        let m = approver(
            StaffRole::Manager,
            StaffRole::Manager.default_permissions(),
            "4321",
            true,
        );
        assert!(authorize_override(&m, "4321", pct(50)).is_ok());
    }

    #[test]
    fn flat_amount_ignores_manager_rule() {
        let c = approver(StaffRole::Cashier, Permissions::APPLY_DISCOUNT, "2222", true);
        let flat = Discount {
            discount_type: DiscountType::FlatAmount(Money {
                amount: Decimal::new(100, 0),
                currency: Currency::Inr,
            }),
            reason: DiscountReason::LoyaltyReward,
            authorized_by: None,
        };
        assert!(authorize_override(&c, "2222", flat).is_ok());
    }
}
