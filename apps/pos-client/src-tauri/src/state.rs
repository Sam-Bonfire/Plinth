use core_domain::ids::{LocationId, TenantId};

#[derive(Debug, Clone)]
pub struct AppContext {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
}
