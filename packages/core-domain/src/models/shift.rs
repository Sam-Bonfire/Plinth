use crate::enums::payment::PaymentMethod;
use crate::ids::{LocationId, ShiftId, StaffMemberId, TenantId, TerminalId};
use crate::value_objects::money::Money;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Shift lifecycle errors
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum ShiftError {
    /// Shift is already closed
    #[error("Shift is already closed")]
    AlreadyClosed,
    /// Cannot close shift while open orders exist
    #[error("Cannot close shift with {0} active open orders")]
    ActiveOrders(u32),
    /// Money calculation error
    #[error("Money calculation error")]
    MoneyError,
}

/// Type of till cash movement
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum CashMovementType {
    /// Cash added into till drawer
    CashIn,
    /// Petty cash paid out from till
    CashOut,
    /// Safe drop to store safe
    SafeDrop,
}

/// Audit record for cash moved in/out of till
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct CashMovement {
    /// Movement identifier
    pub id: Uuid,
    /// Type of movement
    pub movement_type: CashMovementType,
    /// Monetary amount
    pub amount: Money,
    /// Audit reason
    pub reason: String,
    /// Staff member who authorized movement
    pub authorized_by: StaffMemberId,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
}

/// Cash reconciliation count
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct CashDrawerCount {
    /// Physical cash counted in drawer
    pub physical_cash: Money,
    /// Expected cash calculated by system
    pub expected_cash: Money,
}

impl CashDrawerCount {
    /// Computes cash drawer variance (physical - expected)
    #[must_use]
    pub fn variance(&self) -> Money {
        self.physical_cash.clone() - self.expected_cash.clone()
    }
}

/// Terminal work shift aggregate root
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct StoreShift {
    /// Shift identifier
    pub id: ShiftId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Outlet location identifier
    pub location_id: LocationId,
    /// Terminal register identifier
    pub terminal_id: TerminalId,
    /// Staff member who opened the shift
    pub opened_by: StaffMemberId,
    /// Shift start time
    pub opened_at: DateTime<Utc>,
    /// Shift end time
    pub closed_at: Option<DateTime<Utc>>,
    /// Opening float cash amount
    pub opening_float: Money,
    /// Physical cash counted at close
    pub closing_cash: Option<Money>,
    /// Cash movements during shift
    pub movements: Vec<CashMovement>,
    /// Whether shift is closed
    pub is_closed: bool,
}

impl StoreShift {
    /// Opens a new active `StoreShift`.
    #[must_use]
    pub fn open(
        tenant_id: TenantId,
        location_id: LocationId,
        terminal_id: TerminalId,
        opened_by: StaffMemberId,
        opening_float: Money,
    ) -> Self {
        Self {
            id: ShiftId::new(),
            tenant_id,
            location_id,
            terminal_id,
            opened_by,
            opened_at: Utc::now(),
            closed_at: None,
            opening_float,
            closing_cash: None,
            movements: Vec::new(),
            is_closed: false,
        }
    }

    /// Records a cash movement entry (`CashIn`, `CashOut`, `SafeDrop`)
    pub fn record_cash_movement(
        &mut self,
        movement_type: CashMovementType,
        amount: Money,
        reason: String,
        authorized_by: StaffMemberId,
    ) {
        self.movements.push(CashMovement {
            id: Uuid::now_v7(),
            movement_type,
            amount,
            reason,
            authorized_by,
            timestamp: Utc::now(),
        });
    }

    /// Computes expected cash in drawer based on float, sales, refunds, and movements.
    ///
    /// # Errors
    /// Returns `ShiftError::MoneyError` on arithmetic failure.
    pub fn compute_expected_cash(&self, cash_payments: &Money, cash_refunds: &Money) -> Result<Money, ShiftError> {
        let mut expected = self.opening_float.clone() + cash_payments.clone() - cash_refunds.clone();
        for movement in &self.movements {
            match movement.movement_type {
                CashMovementType::CashIn => expected = expected + movement.amount.clone(),
                CashMovementType::CashOut | CashMovementType::SafeDrop => expected = expected - movement.amount.clone(),
            }
        }
        Ok(expected)
    }

    /// Closes the shift and performs till reconciliation.
    ///
    /// # Errors
    /// Returns `ShiftError::AlreadyClosed` if the shift is already closed,
    /// or `ShiftError::ActiveOrders` if there are still open orders.
    pub fn close(
        &mut self,
        physical_cash: Money,
        expected_cash: Money,
        active_open_orders: u32,
    ) -> Result<CashDrawerCount, ShiftError> {
        if self.is_closed {
            return Err(ShiftError::AlreadyClosed);
        }
        if active_open_orders > 0 {
            return Err(ShiftError::ActiveOrders(active_open_orders));
        }
        self.is_closed = true;
        self.closed_at = Some(Utc::now());
        self.closing_cash = Some(physical_cash.clone());
        Ok(CashDrawerCount {
            physical_cash,
            expected_cash,
        })
    }
}

/// End-of-shift Z-Report summary
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct ZReport {
    /// Shift ID
    pub shift_id: ShiftId,
    /// Total gross sales
    pub gross_sales: Money,
    /// Net sales after discounts
    pub net_sales: Money,
    /// Total tax collected
    pub total_tax: Money,
    /// Total discounts applied
    pub total_discounts: Money,
    /// Total surcharges applied
    pub total_charges: Money,
    /// Breakdown by tender/payment method
    pub tender_breakdown: Vec<(PaymentMethod, Money)>,
    /// Cash drawer reconciliation
    pub cash_drawer: CashDrawerCount,
}

#[cfg(test)]
mod tests {
    use crate::ids::{LocationId, StaffMemberId, TenantId, TerminalId};
    use crate::models::shift::{CashMovementType, StoreShift};
    use crate::value_objects::money::{Currency, Money};
    use rust_decimal::Decimal;

    #[test]
    fn test_shift_lifecycle_and_cash_reconciliation() {
        let staff_id = StaffMemberId::new();
        let opening_float = Money {
            amount: Decimal::new(2000, 0),
            currency: Currency::Inr,
        };

        let mut shift = StoreShift::open(
            TenantId::new(),
            LocationId::new(),
            TerminalId::new(),
            staff_id,
            opening_float,
        );

        assert!(!shift.is_closed);

        // Record Safe Drop of 1000
        shift.record_cash_movement(
            CashMovementType::SafeDrop,
            Money { amount: Decimal::new(1000, 0), currency: Currency::Inr },
            "Mid-day safe drop".to_string(),
            staff_id,
        );

        // Cash sales: 5000, refunds: 500
        // Expected: 2000 + 5000 - 500 - 1000 = 5500
        let cash_sales = Money { amount: Decimal::new(5000, 0), currency: Currency::Inr };
        let cash_refunds = Money { amount: Decimal::new(500, 0), currency: Currency::Inr };
        let expected = shift.compute_expected_cash(&cash_sales, &cash_refunds).unwrap();
        assert_eq!(expected.amount, Decimal::new(5500, 0));

        // Refuse close if active open orders
        assert!(shift.close(expected.clone(), expected.clone(), 2).is_err());

        // Successful close
        let count = shift.close(
            Money { amount: Decimal::new(5510, 0), currency: Currency::Inr },
            expected,
            0,
        ).unwrap();
        assert!(shift.is_closed);
        assert_eq!(count.variance().amount, Decimal::new(10, 0)); // +10 INR overage
    }
}
