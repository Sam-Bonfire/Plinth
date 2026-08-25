use crate::ids::{FloorTableId, LocationId, ReservationId, TenantId};
use crate::value_objects::table::FloorSection;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Physical dining table on the restaurant floor
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FloorTable {
    /// Table ID
    pub id: FloorTableId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Outlet location identifier
    pub location_id: LocationId,
    /// Table label / identifier (e.g. "T-14")
    pub label: String,
    /// Guest seating capacity
    pub capacity: u16,
    /// Floor section details
    pub section: FloorSection,
    /// Whether the table is active and available for seating
    pub is_active: bool,
}

/// Table reservation time slot
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReservationSlot {
    /// Reservation ID
    pub id: ReservationId,
    /// Assigned table ID
    pub table_id: FloorTableId,
    /// Guest name
    pub guest_name: String,
    /// Guest phone number
    pub phone: String,
    /// Number of guests
    pub party_size: u16,
    /// Start of reservation window
    pub reserved_from: DateTime<Utc>,
    /// End of reservation window
    pub reserved_until: DateTime<Utc>,
    /// Whether reservation was cancelled
    pub is_cancelled: bool,
}

impl FloorTable {
    /// Creates a new active `FloorTable`.
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        label: String,
        capacity: u16,
        section: FloorSection,
    ) -> Self {
        Self {
            id: FloorTableId::new(),
            tenant_id,
            location_id,
            label,
            capacity,
            section,
            is_active: true,
        }
    }
}

impl ReservationSlot {
    /// Creates a new `ReservationSlot`.
    #[must_use]
    pub fn new(
        table_id: FloorTableId,
        guest_name: String,
        phone: String,
        party_size: u16,
        reserved_from: DateTime<Utc>,
        reserved_until: DateTime<Utc>,
    ) -> Self {
        Self {
            id: ReservationId::new(),
            table_id,
            guest_name,
            phone,
            party_size,
            reserved_from,
            reserved_until,
            is_cancelled: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::ids::{LocationId, TenantId};
    use crate::models::table::{FloorTable, ReservationSlot};
    use crate::value_objects::table::FloorSection;
    use chrono::Utc;

    #[test]
    fn test_table_and_reservation_creation() {
        let table = FloorTable::new(
            TenantId::new(),
            LocationId::new(),
            "Table 4".to_string(),
            4,
            FloorSection {
                name: "Main Dining".to_string(),
                display_order: 1,
            },
        );
        assert_eq!(table.label, "Table 4");
        assert_eq!(table.capacity, 4);
        assert!(table.is_active);

        let now = Utc::now();
        let res = ReservationSlot::new(
            table.id,
            "Anita Sharma".to_string(),
            "+919876543210".to_string(),
            4,
            now,
            now + chrono::Duration::hours(2),
        );
        assert_eq!(res.guest_name, "Anita Sharma");
        assert!(!res.is_cancelled);
    }
}
