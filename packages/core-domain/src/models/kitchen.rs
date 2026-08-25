use crate::enums::kitchen::{KitchenTicketStatus, StationId};
use crate::events::kitchen::KitchenTicketEvent;
use crate::ids::{KitchenTicketId, LocationId, MenuItemId, OrderId, OrderLineItemId, StaffMemberId, TenantId};
use crate::value_objects::modifier::ModifierSelection;
use crate::value_objects::preparation::{PreparationSla, SlaStatus};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors in kitchen ticket operations
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum KitchenError {
    /// Invalid state transition attempted
    #[error("Ticket is already completed or cancelled")]
    InvalidStateTransition,
}

/// Item displayed on a kitchen display ticket
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TicketLineItem {
    /// Order line item reference ID
    pub line_item_id: OrderLineItemId,
    /// Menu item reference ID
    pub menu_item_id: MenuItemId,
    /// Item name
    pub name: String,
    /// Quantity to prepare
    pub quantity: u32,
    /// Customer modifier choices
    pub modifiers: Vec<ModifierSelection>,
    /// Special preparation instructions
    pub special_instructions: Option<String>,
}

/// Kitchen display ticket aggregate root
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KitchenTicket {
    /// Ticket identifier
    pub id: KitchenTicketId,
    /// Originating order ID
    pub order_id: OrderId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Location identifier
    pub location_id: LocationId,
    /// Kitchen station (e.g. Grill, Beverages)
    pub station: StationId,
    /// Daily KOT sequence number
    pub kot_number: u32,
    /// Ticket line items
    pub items: Vec<TicketLineItem>,
    /// Processing status
    pub status: KitchenTicketStatus,
    /// Preparation SLA
    pub sla: PreparationSla,
    /// When ticket was fired
    pub created_at: DateTime<Utc>,
    /// When ticket was bumped/completed
    pub bumped_at: Option<DateTime<Utc>>,
    /// Staff member who bumped the ticket
    pub bumped_by: Option<StaffMemberId>,
    /// When ticket was cancelled
    pub cancelled_at: Option<DateTime<Utc>>,
    /// Reason for cancellation
    pub cancellation_reason: Option<String>,
}

impl KitchenTicket {
    /// Creates a new `KitchenTicket` and emits `KitchenTicketEvent::Created`.
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        order_id: OrderId,
        tenant_id: TenantId,
        location_id: LocationId,
        station: StationId,
        kot_number: u32,
        items: Vec<TicketLineItem>,
        sla: PreparationSla,
    ) -> (Self, KitchenTicketEvent) {
        let now = Utc::now();
        let ticket = Self {
            id: KitchenTicketId::new(),
            order_id,
            tenant_id,
            location_id,
            station: station.clone(),
            kot_number,
            items,
            status: KitchenTicketStatus::Pending,
            sla,
            created_at: now,
            bumped_at: None,
            bumped_by: None,
            cancelled_at: None,
            cancellation_reason: None,
        };
        let event = KitchenTicketEvent::Created {
            ticket_id: ticket.id,
            order_id,
            location_id,
            station,
            kot_number,
            created_at: now,
        };
        (ticket, event)
    }

    /// Bumps (completes) the ticket from the kitchen station.
    ///
    /// # Errors
    /// Returns `KitchenError::InvalidStateTransition` if the ticket is not `Pending`.
    pub fn bump(&mut self, bumped_by: Option<StaffMemberId>) -> Result<KitchenTicketEvent, KitchenError> {
        if self.status != KitchenTicketStatus::Pending {
            return Err(KitchenError::InvalidStateTransition);
        }
        let now = Utc::now();
        self.status = KitchenTicketStatus::Bumped;
        self.bumped_at = Some(now);
        self.bumped_by = bumped_by;
        Ok(KitchenTicketEvent::Bumped {
            ticket_id: self.id,
            bumped_by,
            bumped_at: now,
        })
    }

    /// Cancels the kitchen ticket.
    ///
    /// # Errors
    /// Returns `KitchenError::InvalidStateTransition` if the ticket is not `Pending`.
    pub fn cancel(&mut self, reason: String) -> Result<KitchenTicketEvent, KitchenError> {
        if self.status != KitchenTicketStatus::Pending {
            return Err(KitchenError::InvalidStateTransition);
        }
        let now = Utc::now();
        self.status = KitchenTicketStatus::Cancelled;
        self.cancelled_at = Some(now);
        self.cancellation_reason = Some(reason.clone());
        Ok(KitchenTicketEvent::Cancelled {
            ticket_id: self.id,
            reason,
            cancelled_at: now,
        })
    }

    /// Evaluates the SLA status for this ticket given a point in time
    #[must_use]
    pub fn sla_status(&self, now: DateTime<Utc>) -> SlaStatus {
        let end_time = self.bumped_at.unwrap_or(now);
        let duration = if end_time > self.created_at {
            std::time::Duration::from_secs((end_time - self.created_at).num_seconds().max(0).cast_unsigned())
        } else {
            std::time::Duration::ZERO
        };
        self.sla.evaluate(duration)
    }
}

#[cfg(test)]
mod tests {
    use crate::enums::kitchen::{KitchenTicketStatus, StationId};
    use crate::ids::{LocationId, OrderId, TenantId};
    use crate::models::kitchen::KitchenTicket;
    use crate::value_objects::preparation::{PreparationSla, SlaStatus};

    #[test]
    fn test_kitchen_ticket_lifecycle_and_sla() {
        let sla = PreparationSla::default_restaurant();
        let (mut ticket, create_evt) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            101,
            Vec::new(),
            sla,
        );

        assert_eq!(ticket.status, KitchenTicketStatus::Pending);
        assert_eq!(ticket.kot_number, 101);
        assert_eq!(create_evt.ticket_id(), ticket.id);

        let now = ticket.created_at + chrono::Duration::minutes(5);
        assert_eq!(ticket.sla_status(now), SlaStatus::Warning);

        let bump_evt = ticket.bump(None).unwrap();
        assert_eq!(ticket.status, KitchenTicketStatus::Bumped);
        assert_eq!(bump_evt.ticket_id(), ticket.id);
    }
}
