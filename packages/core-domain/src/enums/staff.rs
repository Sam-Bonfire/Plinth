use bitflags::bitflags;
use serde::{Deserialize, Serialize};

/// Role of a staff member
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StaffRole {
    /// Owner role
    Owner,
    /// Manager role
    Manager,
    /// Cashier role
    Cashier,
    /// Waiter role
    Waiter,
    /// Kitchen staff role
    Kitchen,
}

bitflags! {
    /// Permissions for a staff member
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct Permissions: u32 {
        /// Can take orders
        const TAKE_ORDER       = 0b0000_0000_0000_0001;
        /// Can apply discounts
        const APPLY_DISCOUNT   = 0b0000_0000_0000_0010;
        /// Can void orders
        const VOID_ORDER       = 0b0000_0000_0000_0100;
        /// Can process refunds
        const PROCESS_REFUND   = 0b0000_0000_0000_1000;
        /// Can modify prices
        const MODIFY_PRICE     = 0b0000_0000_0001_0000;
        /// Can access reports
        const ACCESS_REPORTS   = 0b0000_0000_0010_0000;
        /// Can export data
        const EXPORT_DATA      = 0b0000_0000_0100_0000;
        /// Can manage staff
        const MANAGE_STAFF     = 0b0000_0000_1000_0000;
        /// Can manage menu
        const MANAGE_MENU      = 0b0000_0001_0000_0000;
        /// Can open/close shifts
        const OPEN_CLOSE_SHIFT = 0b0000_0010_0000_0000;
    }
}

impl StaffRole {
    /// Returns the default permissions for the role
    #[must_use]
    pub fn default_permissions(&self) -> Permissions {
        match self {
            Self::Owner => Permissions::all(),
            Self::Manager => Permissions::all() - Permissions::MANAGE_STAFF,
            Self::Cashier => Permissions::TAKE_ORDER | Permissions::OPEN_CLOSE_SHIFT,
            Self::Waiter => Permissions::TAKE_ORDER,
            Self::Kitchen => Permissions::empty(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_permissions() {
        assert_eq!(StaffRole::Owner.default_permissions(), Permissions::all());
        
        let manager_perms = StaffRole::Manager.default_permissions();
        assert!(manager_perms.contains(Permissions::TAKE_ORDER));
        assert!(!manager_perms.contains(Permissions::MANAGE_STAFF));

        assert_eq!(
            StaffRole::Cashier.default_permissions(),
            Permissions::TAKE_ORDER | Permissions::OPEN_CLOSE_SHIFT
        );

        assert_eq!(StaffRole::Waiter.default_permissions(), Permissions::TAKE_ORDER);
        
        assert_eq!(StaffRole::Kitchen.default_permissions(), Permissions::empty());
    }
}
