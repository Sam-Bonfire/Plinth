use crate::enums::staff::{Permissions, StaffRole};
use crate::ids::{LocationId, StaffMemberId, TenantId};
use serde::{Deserialize, Serialize};

/// Represents an authenticated restaurant staff employee
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StaffMember {
    /// Staff identifier
    pub id: StaffMemberId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Store location identifier
    pub location_id: LocationId,
    /// Staff member display name
    pub name: String,
    /// Organizational role
    pub role: StaffRole,
    /// Bitflag permissions granted to this staff member
    pub permissions: Permissions,
    /// Fast POS PIN hash (e.g. Argon2 / SHA256 hashed)
    pub pin_hash: String,
    /// Whether account is active
    pub is_active: bool,
}

impl StaffMember {
    /// Creates a new active `StaffMember`.
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        name: String,
        role: StaffRole,
        permissions: Permissions,
        pin_hash: String,
    ) -> Self {
        Self {
            id: StaffMemberId::new(),
            tenant_id,
            location_id,
            name,
            role,
            permissions,
            pin_hash,
            is_active: true,
        }
    }

    /// Checks if the staff member has a specific permission bitflag
    #[must_use]
    pub fn has_permission(&self, perm: Permissions) -> bool {
        self.permissions.contains(perm)
    }

    /// Verifies the provided PIN against the stored hash
    #[must_use]
    pub fn verify_pin(&self, pin: &str) -> bool {
        self.pin_hash == pin
    }
}

#[cfg(test)]
mod tests {
    use crate::enums::staff::{Permissions, StaffRole};
    use crate::ids::{LocationId, TenantId};
    use crate::models::staff::StaffMember;

    #[test]
    fn test_staff_permissions_and_pin() {
        let staff = StaffMember::new(
            TenantId::new(),
            LocationId::new(),
            "Vikram Singh".to_string(),
            StaffRole::Manager,
            StaffRole::Manager.default_permissions(),
            "1234".to_string(),
        );

        assert!(staff.has_permission(Permissions::TAKE_ORDER));
        assert!(staff.has_permission(Permissions::APPLY_DISCOUNT));
        assert!(!staff.has_permission(Permissions::MANAGE_STAFF));

        assert!(staff.verify_pin("1234"));
        assert!(!staff.verify_pin("0000"));
    }
}
