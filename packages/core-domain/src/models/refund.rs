use crate::enums::refund::{RefundReason, RefundStatus, RefundType};
use crate::ids::{LocationId, OrderId, OrderLineItemId, RefundId, StaffMemberId, TenantId};
use crate::value_objects::money::Money;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Refund processing errors
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum RefundError {
    /// Invalid refund state transition
    #[error("Invalid refund state transition")]
    InvalidStateTransition,
}

/// Line item included in a partial or itemized refund
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RefundLineItem {
    /// Associated order line item
    pub line_item_id: OrderLineItemId,
    /// Quantity being refunded
    pub quantity: u32,
    /// Monetary refund amount
    pub amount: Money,
}

/// Order refund aggregate root
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrderRefund {
    /// Refund identifier
    pub id: RefundId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Outlet location identifier
    pub location_id: LocationId,
    /// Target order ID
    pub order_id: OrderId,
    /// Type of refund
    pub refund_type: RefundType,
    /// Refund audit reason
    pub reason: RefundReason,
    /// Monetary refund amount
    pub amount: Money,
    /// Refunded line items
    pub items: Vec<RefundLineItem>,
    /// Status of refund workflow
    pub status: RefundStatus,
    /// Staff member who authorized the refund
    pub authorized_by: StaffMemberId,
    /// When refund request was created
    pub created_at: DateTime<Utc>,
    /// When refund was completed
    pub processed_at: Option<DateTime<Utc>>,
}

impl OrderRefund {
    /// Creates a new pending `OrderRefund`.
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        order_id: OrderId,
        refund_type: RefundType,
        reason: RefundReason,
        amount: Money,
        items: Vec<RefundLineItem>,
        authorized_by: StaffMemberId,
    ) -> Self {
        Self {
            id: RefundId::new(),
            tenant_id,
            location_id,
            order_id,
            refund_type,
            reason,
            amount,
            items,
            status: RefundStatus::Pending,
            authorized_by,
            created_at: Utc::now(),
            processed_at: None,
        }
    }

    /// Approves a pending refund.
    ///
    /// # Errors
    /// Returns `RefundError::InvalidStateTransition` if refund is not in `Pending` state.
    pub fn approve(&mut self) -> Result<(), RefundError> {
        if self.status != RefundStatus::Pending {
            return Err(RefundError::InvalidStateTransition);
        }
        self.status = RefundStatus::Approved;
        Ok(())
    }

    /// Processes an approved refund.
    ///
    /// # Errors
    /// Returns `RefundError::InvalidStateTransition` if refund is not in `Approved` state.
    pub fn process(&mut self) -> Result<(), RefundError> {
        if self.status != RefundStatus::Approved {
            return Err(RefundError::InvalidStateTransition);
        }
        self.status = RefundStatus::Processed;
        self.processed_at = Some(Utc::now());
        Ok(())
    }

    /// Rejects a pending refund.
    ///
    /// # Errors
    /// Returns `RefundError::InvalidStateTransition` if refund is not in `Pending` state.
    pub fn reject(&mut self) -> Result<(), RefundError> {
        if self.status != RefundStatus::Pending {
            return Err(RefundError::InvalidStateTransition);
        }
        self.status = RefundStatus::Rejected;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::enums::refund::{RefundReason, RefundStatus, RefundType};
    use crate::ids::{LocationId, OrderId, StaffMemberId, TenantId};
    use crate::models::refund::OrderRefund;
    use crate::value_objects::money::{Currency, Money};
    use rust_decimal::Decimal;

    #[test]
    fn test_refund_lifecycle() {
        let mut refund = OrderRefund::new(
            TenantId::new(),
            LocationId::new(),
            OrderId::new(),
            RefundType::Full,
            RefundReason::CustomerComplaint,
            Money { amount: Decimal::new(500, 0), currency: Currency::Inr },
            Vec::new(),
            StaffMemberId::new(),
        );

        assert_eq!(refund.status, RefundStatus::Pending);
        assert!(refund.process().is_err()); // Cannot process before approve

        refund.approve().unwrap();
        assert_eq!(refund.status, RefundStatus::Approved);

        refund.process().unwrap();
        assert_eq!(refund.status, RefundStatus::Processed);
        assert!(refund.processed_at.is_some());
    }
}
