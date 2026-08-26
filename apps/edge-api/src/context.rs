use core_domain::ids::{TenantId, LocationId, StaffMemberId};
use core_domain::enums::staff::Permissions;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantContext {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub staff_id: StaffMemberId,
    pub permissions: Permissions,
}
