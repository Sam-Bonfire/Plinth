use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::enums::{KitchenTicketStatus, StationId};
use crate::ids::{KitchenTicketId, LocationId, OrderId, StaffMemberId};

/// Domain events emitted by the Kitchen Ticket aggregate
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum KitchenTicketEvent {
    /// Event when a ticket is created
    Created {
        /// Ticket ID
        ticket_id: KitchenTicketId,
        /// Order ID
        order_id: OrderId,
        /// Location ID
        location_id: LocationId,
        /// Station ID
        station: StationId,
        /// KOT number
        kot_number: u32,
        /// Timestamp
        created_at: DateTime<Utc>,
    },
    /// Event when status changes
    StatusChanged {
        /// Ticket ID
        ticket_id: KitchenTicketId,
        /// Previous status
        from: KitchenTicketStatus,
        /// New status
        to: KitchenTicketStatus,
        /// Timestamp
        changed_at: DateTime<Utc>,
    },
    /// Event when ticket is bumped
    Bumped {
        /// Ticket ID
        ticket_id: KitchenTicketId,
        /// Staff member who bumped
        bumped_by: Option<StaffMemberId>,
        /// Timestamp
        bumped_at: DateTime<Utc>,
    },
    /// Event when ticket is cancelled
    Cancelled {
        /// Ticket ID
        ticket_id: KitchenTicketId,
        /// Reason for cancellation
        reason: String,
        /// Timestamp
        cancelled_at: DateTime<Utc>,
    },
}

impl KitchenTicketEvent {
    /// Get the ticket ID associated with this event
    #[must_use]
    pub fn ticket_id(&self) -> KitchenTicketId {
        match self {
            Self::Created { ticket_id, .. }
            | Self::StatusChanged { ticket_id, .. }
            | Self::Bumped { ticket_id, .. }
            | Self::Cancelled { ticket_id, .. } => *ticket_id,
        }
    }

    /// Get the timestamp when this event occurred
    #[must_use]
    pub fn occurred_at(&self) -> DateTime<Utc> {
        match self {
            Self::Created { created_at, .. } => *created_at,
            Self::StatusChanged { changed_at, .. } => *changed_at,
            Self::Bumped { bumped_at, .. } => *bumped_at,
            Self::Cancelled { cancelled_at, .. } => *cancelled_at,
        }
    }
}
