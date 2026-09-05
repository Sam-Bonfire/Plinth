use crate::enums::order_channel::OrderChannel;
use crate::enums::order_status::OrderStatus;
use crate::enums::payment::{PaymentMethod, PaymentStatus};
use crate::events::order::OrderEvent;
use crate::ids::{FloorTableId, LocationId, MenuItemId, OrderId, OrderLineItemId, StaffMemberId, TenantId, TerminalId};
use crate::value_objects::discount::Discount;
use crate::value_objects::modifier::ModifierSelection;
use crate::value_objects::money::{Currency, Money};
use crate::value_objects::order_charge::OrderCharge;
use crate::value_objects::table::SeatNumber;
use crate::value_objects::tax::{compute_gst, GstApplicability, GstRate, TaxBreakdown};
use crate::value_objects::tip::TipAmount;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors associated with order state transitions and modifications
#[derive(Debug, Error)]
#[non_exhaustive]
pub enum OrderError {
    /// Line item not present in order
    #[error("Line item not found: {0}")]
    LineItemNotFound(OrderLineItemId),
    /// Order is already settled
    #[error("Order is already settled")]
    AlreadySettled,
    /// Order is voided
    #[error("Order is voided")]
    AlreadyVoided,
    /// Payment is insufficient to settle order
    #[error("Cannot settle order, payment is insufficient. Paid: {paid}, Total: {total}")]
    InsufficientPayment {
        /// Amount paid so far
        paid: Money,
        /// Grand total due
        total: Money,
    },
    /// Staff member does not have sufficient permission
    #[error("Insufficient permissions for action")]
    PermissionDenied,
    /// Invalid item quantity
    #[error("Invalid quantity: {0}")]
    InvalidQuantity(u32),
    /// Cannot split zero items
    #[error("Cannot split order with zero items")]
    SplitEmpty,
    /// A discount on the order is invalid (out of range, exceeds subtotal, currency mismatch)
    #[error("Invalid discount: {0}")]
    InvalidDiscount(#[from] crate::value_objects::discount::DiscountError),
}

/// Item line in an order
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct OrderLineItem {
    /// Line item unique ID
    pub id: OrderLineItemId,
    /// Menu item catalogue reference ID
    pub menu_item_id: MenuItemId,
    /// Item name at time of order
    pub name: String,
    /// Base menu item price
    pub base_price: Money,
    /// Selected modifier options
    pub modifier_selections: Vec<ModifierSelection>,
    /// Total price delta from modifiers
    pub modifier_total: Money,
    /// Computed unit price (base + modifiers)
    pub unit_price: Money,
    /// Total quantity ordered
    pub quantity: u32,
    /// Quantity already fired to kitchen
    pub fired_quantity: u32,
    /// Applicable GST tax slab rate
    pub tax_rate: GstRate,
    /// Special preparation note
    pub notes: Option<String>,
    /// Guest seat number assignment
    pub seat_number: Option<SeatNumber>,
}

impl OrderLineItem {
    /// Computes total price for this line item (`unit_price` * quantity)
    #[must_use]
    pub fn line_total(&self) -> Money {
        self.unit_price.mul_quantity(self.quantity)
    }

    /// Computes unfired item delta quantity
    #[must_use]
    pub fn unfired_quantity(&self) -> u32 {
        self.quantity.saturating_sub(self.fired_quantity)
    }

    /// Marks all ordered quantity as fired to the kitchen
    pub fn mark_fired(&mut self) {
        self.fired_quantity = self.quantity;
    }
}

/// Payment tender recorded against an order
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct PaymentEntry {
    /// Tender method (Cash, UPI, Card, Wallet)
    pub method: PaymentMethod,
    /// Amount paid
    pub amount: Money,
    /// External transaction reference
    pub reference: Option<String>,
    /// Payment state
    pub status: PaymentStatus,
    /// Timestamp
    pub recorded_at: DateTime<Utc>,
    /// Staff member who took payment
    pub recorded_by: StaffMemberId,
}

/// Order aggregate root
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct Order {
    /// Order identifier
    pub id: OrderId,
    /// Tenant identifier
    pub tenant_id: TenantId,
    /// Outlet location identifier
    pub location_id: LocationId,
    /// POS terminal register identifier
    pub terminal_id: TerminalId,
    /// Order placement channel
    pub channel: OrderChannel,
    /// Order state machine status
    pub status: OrderStatus,
    /// Assigned dining table
    pub table_id: Option<FloorTableId>,
    /// Assigned seat number
    pub seat_number: Option<SeatNumber>,
    /// Ordered line items
    pub items: Vec<OrderLineItem>,
    /// Applied discounts
    pub discounts: Vec<Discount>,
    /// Applied surcharges/fees
    pub charges: Vec<OrderCharge>,
    /// Gratuity / tip
    pub tip: Option<TipAmount>,
    /// Recorded payment transactions
    pub payments: Vec<PaymentEntry>,
    /// Originating order ID if split from another order
    pub split_from: Option<OrderId>,
    /// Staff member who opened the order
    pub created_by: StaffMemberId,
    /// Order creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Soft deletion timestamp
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Order {
    /// Creates a new draft `Order` and emits `OrderEvent::Created`.
    #[allow(clippy::too_many_arguments)]
    #[must_use]
    pub fn new(
        tenant_id: TenantId,
        location_id: LocationId,
        terminal_id: TerminalId,
        channel: OrderChannel,
        created_by: StaffMemberId,
        table_id: Option<FloorTableId>,
        seat_number: Option<SeatNumber>,
    ) -> (Self, OrderEvent) {
        let now = Utc::now();
        let order = Self {
            id: OrderId::new(),
            tenant_id,
            location_id,
            terminal_id,
            channel,
            status: OrderStatus::Draft,
            table_id,
            seat_number,
            items: Vec::new(),
            discounts: Vec::new(),
            charges: Vec::new(),
            tip: None,
            payments: Vec::new(),
            split_from: None,
            created_by,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };
        let event = OrderEvent::Created {
            order_id: order.id,
            tenant_id: order.tenant_id,
            location_id: order.location_id,
            terminal_id: order.terminal_id,
            channel: order.channel,
            created_by: order.created_by,
            created_at: now,
        };
        (order, event)
    }

    /// Adds a line item to the order.
    ///
    /// # Errors
    /// Returns `OrderError` if the order cannot be modified.
    pub fn add_item(&mut self, item: OrderLineItem) -> Result<OrderEvent, OrderError> {
        let item_id = item.id;
        let menu_item_id = item.menu_item_id;
        let item_name = item.name.clone();
        let quantity = item.quantity;
        let unit_price_minor = item.unit_price.to_minor_units();
        let modifier_total_minor = item.modifier_total.to_minor_units();
        
        self.items.push(item);
        self.updated_at = Utc::now();
        Ok(OrderEvent::ItemAdded {
            order_id: self.id,
            line_item_id: item_id,
            menu_item_id,
            item_name,
            quantity,
            unit_price_minor,
            modifier_total_minor,
            added_at: self.updated_at,
        })
    }

    /// Removes an item line from the order.
    ///
    /// # Errors
    /// Returns `OrderError::LineItemNotFound` if the line item is not in the order.
    pub fn remove_item(&mut self, line_item_id: OrderLineItemId, reason: Option<String>) -> Result<OrderEvent, OrderError> {
        let initial_len = self.items.len();
        self.items.retain(|i| i.id != line_item_id);
        if self.items.len() == initial_len {
            return Err(OrderError::LineItemNotFound(line_item_id));
        }
        self.updated_at = Utc::now();
        Ok(OrderEvent::ItemRemoved {
            order_id: self.id,
            line_item_id,
            reason,
            removed_at: self.updated_at,
        })
    }

    /// Updates the quantity of an existing line item.
    ///
    /// # Errors
    /// Returns `OrderError::InvalidQuantity` if quantity is 0,
    /// or `OrderError::LineItemNotFound` if the line item does not exist.
    pub fn change_quantity(&mut self, line_item_id: OrderLineItemId, new_quantity: u32) -> Result<OrderEvent, OrderError> {
        if new_quantity == 0 {
            return Err(OrderError::InvalidQuantity(0));
        }
        let item = self.items.iter_mut().find(|i| i.id == line_item_id).ok_or(OrderError::LineItemNotFound(line_item_id))?;
        let old_quantity = item.quantity;
        item.quantity = new_quantity;
        self.updated_at = Utc::now();
        Ok(OrderEvent::ItemQuantityChanged {
            order_id: self.id,
            line_item_id,
            old_quantity,
            new_quantity,
            changed_at: self.updated_at,
        })
    }

    /// Applies a discount to the order.
    ///
    /// # Errors
    /// Returns `OrderError` if the discount is invalid.
    pub fn apply_discount(&mut self, discount: Discount) -> Result<OrderEvent, OrderError> {
        let percentage = match &discount.discount_type {
            crate::value_objects::discount::DiscountType::Percentage(p) => Some(p.to_string()),
            crate::value_objects::discount::DiscountType::FlatAmount(_) => None,
        };
        let flat_minor = match &discount.discount_type {
            crate::value_objects::discount::DiscountType::FlatAmount(f) => Some(f.to_minor_units()),
            crate::value_objects::discount::DiscountType::Percentage(_) => None,
        };
        
        let reason_str = format!("{:?}", discount.reason);
        let authorized_by = discount.authorized_by;

        self.discounts.push(discount);
        self.updated_at = Utc::now();
        Ok(OrderEvent::DiscountApplied {
            order_id: self.id,
            discount_percentage: percentage,
            discount_flat_minor: flat_minor,
            reason: reason_str,
            authorized_by,
            applied_at: self.updated_at,
        })
    }

    /// Removes all discounts from the order.
    ///
    /// # Errors
    /// Returns `OrderError` if discounts cannot be removed.
    pub fn remove_discount(&mut self, _reason: &str) -> Result<OrderEvent, OrderError> {
        self.discounts.clear();
        self.updated_at = Utc::now();
        Ok(OrderEvent::DiscountRemoved {
            order_id: self.id,
            removed_at: self.updated_at,
        })
    }

    /// Adds a surcharge or order charge.
    ///
    /// # Errors
    /// Returns `OrderError` if charge cannot be added.
    pub fn add_charge(&mut self, charge: OrderCharge) -> Result<OrderEvent, OrderError> {
        let charge_type = format!("{:?}", charge.charge_type);
        let amount_minor = charge.amount.to_minor_units();
        let taxable = true;
        
        self.charges.push(charge);
        self.updated_at = Utc::now();
        Ok(OrderEvent::ChargeAdded {
            order_id: self.id,
            charge_type,
            amount_minor,
            taxable,
            added_at: self.updated_at,
        })
    }

    /// Records a customer payment.
    ///
    /// # Errors
    /// Returns `OrderError` if payment cannot be recorded.
    pub fn record_payment(&mut self, method: PaymentMethod, amount: Money, reference: Option<String>, recorded_by: StaffMemberId) -> Result<OrderEvent, OrderError> {
        let amount_minor = amount.to_minor_units();
        self.payments.push(PaymentEntry {
            method,
            amount,
            reference: reference.clone(),
            status: PaymentStatus::Completed,
            recorded_at: Utc::now(),
            recorded_by,
        });
        self.updated_at = Utc::now();
        Ok(OrderEvent::PaymentRecorded {
            order_id: self.id,
            method,
            amount_minor,
            reference,
            recorded_at: self.updated_at,
        })
    }

    /// Adds gratuity / tip to the order.
    ///
    /// # Errors
    /// Returns `OrderError` if tip cannot be added.
    pub fn add_tip(&mut self, tip: TipAmount) -> Result<OrderEvent, OrderError> {
        let amount_minor = tip.computed_amount.to_minor_units();
        self.tip = Some(tip);
        self.updated_at = Utc::now();
        Ok(OrderEvent::TipAdded {
            order_id: self.id,
            amount_minor,
            recipient: None,
            added_at: self.updated_at,
        })
    }

    /// Splits specific line items off into a new child order.
    ///
    /// # Errors
    /// Returns `OrderError::SplitEmpty` if no items are specified,
    /// `OrderError::LineItemNotFound` if item does not exist,
    /// or `OrderError::InvalidQuantity` if split quantity exceeds available quantity.
    pub fn split_bill(&mut self, items_to_move: Vec<(OrderLineItemId, u32)>, new_terminal_id: TerminalId, split_by: StaffMemberId) -> Result<(Order, OrderEvent), OrderError> {
        if items_to_move.is_empty() {
            return Err(OrderError::SplitEmpty);
        }
        let mut new_items = Vec::new();
        for (item_id, qty) in items_to_move {
            let item = self.items.iter_mut().find(|i| i.id == item_id).ok_or(OrderError::LineItemNotFound(item_id))?;
            if qty > item.quantity {
                return Err(OrderError::InvalidQuantity(qty));
            }
            let mut new_item = item.clone();
            new_item.quantity = qty;
            new_item.fired_quantity = std::cmp::min(item.fired_quantity, qty);
            item.quantity -= qty;
            item.fired_quantity = item.fired_quantity.saturating_sub(new_item.fired_quantity);
            new_items.push(new_item);
        }
        self.items.retain(|i| i.quantity > 0);
        
        let (mut new_order, _) = Order::new(self.tenant_id, self.location_id, new_terminal_id, self.channel, split_by, self.table_id, self.seat_number);
        new_order.split_from = Some(self.id);
        new_order.items = new_items;
        
        self.updated_at = Utc::now();
        Ok((new_order.clone(), OrderEvent::BillSplit {
            parent_order_id: self.id,
            child_order_ids: vec![new_order.id],
            split_at: self.updated_at,
        }))
    }

    /// Voids the order with supervisor authorization.
    ///
    /// # Errors
    /// Returns `OrderError::AlreadyVoided` if already voided,
    /// or `OrderError::PermissionDenied` if not authorized by a supervisor.
    pub fn void_order(&mut self, reason: String, voided_by: StaffMemberId, is_supervisor: bool) -> Result<OrderEvent, OrderError> {
        if self.status == OrderStatus::Voided {
            return Err(OrderError::AlreadyVoided);
        }
        if !is_supervisor {
            return Err(OrderError::PermissionDenied);
        }
        self.status = OrderStatus::Voided;
        self.updated_at = Utc::now();
        Ok(OrderEvent::Voided {
            order_id: self.id,
            reason,
            voided_by,
            requires_supervisor: true,
            voided_at: self.updated_at,
        })
    }

    /// Settles the order after verifying full payment has been received.
    ///
    /// # Errors
    /// Returns `OrderError::AlreadySettled` if already settled,
    /// `OrderError::InvalidDiscount` if a discount fails validation,
    /// or `OrderError::InsufficientPayment` if amount paid is less than grand total.
    pub fn settle(&mut self, applicability: &GstApplicability) -> Result<OrderEvent, OrderError> {
        if self.status == OrderStatus::Settled {
            return Err(OrderError::AlreadySettled);
        }
        let total = self.grand_total(applicability)?;
        let paid = self.total_paid();
        if paid < total {
            return Err(OrderError::InsufficientPayment { paid, total });
        }
        self.status = OrderStatus::Settled;
        self.updated_at = Utc::now();
        Ok(OrderEvent::Settled {
            order_id: self.id,
            total_minor: total.to_minor_units(),
            settled_at: self.updated_at,
        })
    }

    #[must_use]
    pub fn subtotal(&self) -> Money {
        self.items.iter().map(OrderLineItem::line_total).sum()
    }

    /// Sums validated discount amounts. Unlike the previous implementation,
    /// discount computation failures propagate instead of being silently dropped.
    ///
    /// # Errors
    /// Returns the first `DiscountError` if any discount is invalid.
    pub fn discount_total(&self) -> Result<Money, crate::value_objects::discount::DiscountError> {
        let subtotal = self.subtotal();
        // compute_amount already rejects cross-currency discounts, so accumulating
        // raw amounts here adds no new panic surface.
        let mut total = Decimal::ZERO;
        for discount in &self.discounts {
            total += discount.compute_amount(&subtotal)?.amount;
        }
        Ok(Money { amount: total, currency: subtotal.currency })
    }

    #[must_use]
    pub fn charge_total(&self) -> Money {
        self.charges.iter().map(|c| c.amount.clone()).sum()
    }

    #[must_use]
    pub fn compute_tax_breakdown(&self, applicability: &GstApplicability) -> TaxBreakdown {
        let mut slab_totals: std::collections::HashMap<GstRate, Decimal> = std::collections::HashMap::new();
        for item in &self.items {
            let line_total = item.line_total();
            *slab_totals.entry(item.tax_rate).or_insert(Decimal::ZERO) += line_total.amount;
        }
        let mut total_tax = Money::zero(Currency::Inr);
        let mut components = Vec::new();
        for (rate, amount) in slab_totals {
            let slab_money = Money { amount, currency: Currency::Inr };
            let breakdown = compute_gst(&slab_money, &rate, applicability);
            total_tax = total_tax + breakdown.total_tax;
            components.extend(breakdown.components);
        }
        TaxBreakdown { total_tax, components }
    }

    /// Computes the payable total. Discount validation failures propagate
    /// so an invalid discount can never silently undercharge.
    ///
    /// # Errors
    /// Returns `OrderError::InvalidDiscount` if any discount is invalid.
    pub fn grand_total(
        &self,
        applicability: &GstApplicability,
    ) -> Result<Money, OrderError> {
        let subtotal = self.subtotal();
        let discount = self.discount_total()?;
        let mut total = subtotal - discount;
        total = total + self.charge_total();
        total = total + self.compute_tax_breakdown(applicability).total_tax;
        if let Some(tip) = &self.tip {
            total = total + tip.computed_amount.clone();
        }
        Ok(total)
    }

    #[must_use]
    pub fn total_paid(&self) -> Money {
        self.payments.iter().filter(|p| p.status == PaymentStatus::Completed).map(|p| p.amount.clone()).sum()
    }

    /// # Errors
    /// Returns `OrderError::InvalidDiscount` if any discount is invalid.
    pub fn balance_due(
        &self,
        applicability: &GstApplicability,
    ) -> Result<Money, OrderError> {
        Ok(self.grand_total(applicability)? - self.total_paid())
    }

    /// # Errors
    /// Returns `OrderError::InvalidDiscount` if any discount is invalid.
    pub fn is_fully_paid(
        &self,
        applicability: &GstApplicability,
    ) -> Result<bool, OrderError> {
        Ok(self.total_paid() >= self.grand_total(applicability)?)
    }

    #[must_use]
    pub fn has_unfired_items(&self) -> bool {
        self.items.iter().any(|i| i.unfired_quantity() > 0)
    }

    pub fn mark_all_fired(&mut self) {
        for item in &mut self.items {
            item.mark_fired();
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::enums::order_channel::OrderChannel;
    use crate::enums::order_status::OrderStatus;
    use crate::enums::payment::PaymentMethod;
    use crate::ids::{LocationId, MenuItemId, OrderLineItemId, StaffMemberId, TenantId, TerminalId};
    use crate::models::order::{Order, OrderError, OrderLineItem};
    use crate::value_objects::money::{Currency, Money};
    use crate::value_objects::tax::{GstApplicability, GstRate};
    use rust_decimal::Decimal;

    #[test]
    fn test_order_lifecycle_and_financials() {
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();

        let (mut order, create_evt) = Order::new(
            tenant_id,
            location_id,
            terminal_id,
            OrderChannel::DineIn,
            staff_id,
            None,
            None,
        );
        assert_eq!(create_evt.order_id(), order.id);
        assert_eq!(order.status, OrderStatus::Draft);

        let item1 = OrderLineItem {
            id: OrderLineItemId::new(),
            menu_item_id: MenuItemId::new(),
            name: "Dal Makhani".to_string(),
            base_price: Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            modifier_selections: Vec::new(),
            modifier_total: Money::zero(Currency::Inr),
            unit_price: Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            quantity: 2,
            fired_quantity: 0,
            tax_rate: GstRate::FivePercent,
            notes: None,
            seat_number: None,
        };

        order.add_item(item1).unwrap();
        assert_eq!(
            order.subtotal(),
            Money { amount: Decimal::new(400, 0), currency: Currency::Inr }
        );
        assert!(order.has_unfired_items());

        // 5% GST on 400 = 20 INR
        let tax = order.compute_tax_breakdown(&GstApplicability::IntraState);
        assert_eq!(
            tax.total_tax,
            Money { amount: Decimal::new(20, 0), currency: Currency::Inr }
        );

        let grand = order.grand_total(&GstApplicability::IntraState).unwrap();
        assert_eq!(
            grand,
            Money { amount: Decimal::new(420, 0), currency: Currency::Inr }
        );

        // Record partial payment
        order.record_payment(
            PaymentMethod::Cash,
            Money { amount: Decimal::new(200, 0), currency: Currency::Inr },
            None,
            staff_id,
        ).unwrap();
        assert!(!order.is_fully_paid(&GstApplicability::IntraState).unwrap());
        assert!(order.settle(&GstApplicability::IntraState).is_err());

        // Record remaining payment
        order.record_payment(
            PaymentMethod::Upi,
            Money { amount: Decimal::new(220, 0), currency: Currency::Inr },
            Some("UPI123".to_string()),
            staff_id,
        ).unwrap();
        assert!(order.is_fully_paid(&GstApplicability::IntraState).unwrap());

        let settle_evt = order.settle(&GstApplicability::IntraState).unwrap();
        assert_eq!(settle_evt.order_id(), order.id);
        assert_eq!(order.status, OrderStatus::Settled);
    }

    #[test]
    fn test_order_void_supervisor_requirement() {
        let tenant_id = TenantId::new();
        let location_id = LocationId::new();
        let terminal_id = TerminalId::new();
        let staff_id = StaffMemberId::new();

        let (mut order, _) = Order::new(
            tenant_id,
            location_id,
            terminal_id,
            OrderChannel::DineIn,
            staff_id,
            None,
            None,
        );

        // Non-supervisor void attempt fails
        assert_eq!(
            order.void_order("Guest left".to_string(), staff_id, false).unwrap_err().to_string(),
            OrderError::PermissionDenied.to_string()
        );

        // Supervisor void attempt succeeds
        assert!(order.void_order("Guest left".to_string(), staff_id, true).is_ok());
        assert_eq!(order.status, OrderStatus::Voided);
    }

    #[test]
    fn test_invalid_discount_propagates_not_silently_dropped() {
        use crate::value_objects::discount::{Discount, DiscountReason, DiscountType};

        let (mut order, _) = Order::new(
            TenantId::new(),
            LocationId::new(),
            TerminalId::new(),
            OrderChannel::DineIn,
            StaffMemberId::new(),
            None,
            None,
        );

        order
            .apply_discount(Discount {
                discount_type: DiscountType::Percentage(Decimal::new(200, 0)),
                reason: DiscountReason::ManagerComp,
                authorized_by: None,
            })
            .unwrap();

        assert!(order.discount_total().is_err());
        assert!(order.grand_total(&GstApplicability::IntraState).is_err());
        assert!(matches!(
            order.settle(&GstApplicability::IntraState).unwrap_err(),
            OrderError::InvalidDiscount(_)
        ));
    }
}
