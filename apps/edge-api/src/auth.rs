use core_domain::ids::{LocationId, TenantId};
use std::str::FromStr;
use uuid::Uuid;
use worker::{Error, Headers, Result};

pub struct TenantContext {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
}

impl TenantContext {
    #[allow(clippy::missing_panics_doc)]
    /// Extracts tenant context from request headers
    /// # Errors
    /// Returns an error if the headers are missing or not formatted as valid UUIDs.
    pub fn from_headers(headers: &Headers) -> Result<Self> {
        let tenant_id_str = headers
            .get("x-tenant-id")?
            .ok_or_else(|| Error::RustError("Missing x-tenant-id".to_string()))?;
        let location_id_str = headers
            .get("x-location-id")?
            .ok_or_else(|| Error::RustError("Missing x-location-id".to_string()))?;

        let tenant_uuid = Uuid::from_str(&tenant_id_str)
            .map_err(|_| Error::RustError("Invalid tenant id format".to_string()))?;
        let location_uuid = Uuid::from_str(&location_id_str)
            .map_err(|_| Error::RustError("Invalid location id format".to_string()))?;

        Ok(Self {
            tenant_id: TenantId::from(tenant_uuid),
            location_id: LocationId::from(location_uuid),
        })
    }
}
