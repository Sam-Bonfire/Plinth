use serde::{Deserialize, Serialize};

/// Role of a staff member
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
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

/// Permissions for a staff member
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[specta(transparent)]
pub struct Permissions(pub u32);

impl Permissions {
    pub const TAKE_ORDER: Self = Self(0b0000_0000_0000_0001);
    pub const APPLY_DISCOUNT: Self = Self(0b0000_0000_0000_0010);
    pub const VOID_ORDER: Self = Self(0b0000_0000_0000_0100);
    pub const PROCESS_REFUND: Self = Self(0b0000_0000_0000_1000);
    pub const MODIFY_PRICE: Self = Self(0b0000_0000_0001_0000);
    pub const ACCESS_REPORTS: Self = Self(0b0000_0000_0010_0000);
    pub const EXPORT_DATA: Self = Self(0b0000_0000_0100_0000);
    pub const MANAGE_STAFF: Self = Self(0b0000_0000_1000_0000);
    pub const MANAGE_MENU: Self = Self(0b0000_0001_0000_0000);
    pub const OPEN_CLOSE_SHIFT: Self = Self(0b0000_0010_0000_0000);

    #[must_use]
    pub const fn empty() -> Self {
        Self(0)
    }

    #[must_use]
    pub const fn all() -> Self {
        Self(0b0000_0011_1111_1111)
    }

    #[must_use]
    pub const fn contains(&self, other: Self) -> bool {
        (self.0 & other.0) == other.0
    }

    #[must_use]
    pub const fn bits(&self) -> u32 {
        self.0
    }

    #[must_use]
    pub const fn from_bits_truncate(bits: u32) -> Self {
        Self(bits)
    }
}

impl std::ops::BitOr for Permissions {
    type Output = Self;
    fn bitor(self, rhs: Self) -> Self {
        Self(self.0 | rhs.0)
    }
}

impl std::ops::BitAnd for Permissions {
    type Output = Self;
    fn bitand(self, rhs: Self) -> Self {
        Self(self.0 & rhs.0)
    }
}

impl std::ops::Sub for Permissions {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self(self.0 & !rhs.0)
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
