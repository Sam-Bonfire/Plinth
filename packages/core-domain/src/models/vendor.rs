use crate::ids::{LocationId, TenantId, VendorId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Represents a vendor in the system.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct Vendor {
    pub id: VendorId,
    pub tenant_id: TenantId,
    pub location_id: LocationId,
    pub name: String,
    pub contact: String,
    pub rate: Decimal,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
