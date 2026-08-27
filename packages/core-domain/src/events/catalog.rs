use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::{LocationId, MenuItemId, StaffMemberId, TenantId};

/// Domain events emitted by the Catalog context
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CatalogEvent {
    /// Event when a menu item's availability changes (86 toggle)
    MenuItemAvailabilityChanged {
        /// Menu item ID
        menu_item_id: MenuItemId,
        /// Tenant ID
        tenant_id: TenantId,
        /// Location ID
        location_id: LocationId,
        /// New availability state
        is_available: bool,
        /// Reason for change
        reason: Option<String>,
        /// Staff member who made the change
        changed_by: Option<StaffMemberId>,
        /// Timestamp
        changed_at: DateTime<Utc>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_catalog_event_serialization() {
        let event = CatalogEvent::MenuItemAvailabilityChanged {
            menu_item_id: MenuItemId::new(),
            tenant_id: TenantId::new(),
            location_id: LocationId::new(),
            is_available: false,
            reason: Some("Out of stock".to_string()),
            changed_by: Some(StaffMemberId::new()),
            changed_at: Utc::now(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Out of stock"));
        assert!(json.contains("MenuItemAvailabilityChanged"));
    }
}
