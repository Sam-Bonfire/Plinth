use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::ids::{
    FloorTableId, KitchenTicketId, LocationId, MenuItemId, OrderId, ShiftId, StockItemId,
    TenantId,
};
use crate::enums::{KitchenTicketStatus, OrderStatus, StationId};
use crate::events::order::OrderEvent;
use crate::models::{Order, KitchenTicket, StockItem, Recipe};

#[derive(Debug, Error)]
pub enum PortError {
    #[error("Entity '{entity}' with id '{id}' not found")]
    NotFound { entity: &'static str, id: String },

    #[error("Conflict detected: {message}")]
    Conflict { message: String },

    #[error("Underlying storage unavailable: {reason}")]
    StorageUnavailable { reason: String },

    #[error("Connection timed out")]
    ConnectionTimeout,

    #[error("Serialization / deserialization failed: {message}")]
    SerializationError { message: String },

    #[error("Internal port error: {message}")]
    Internal { message: String },
}

#[derive(Debug, Clone, Default)]
pub struct OrderFilter {
    pub tenant_id: Option<TenantId>,
    pub location_id: Option<LocationId>,
    pub table_id: Option<FloorTableId>,
    pub status: Option<OrderStatus>,
    pub shift_id: Option<ShiftId>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct TicketFilter {
    pub tenant_id: Option<TenantId>,
    pub location_id: Option<LocationId>,
    pub station: Option<StationId>,
    pub status: Option<KitchenTicketStatus>,
    pub order_id: Option<OrderId>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct InventoryFilter {
    pub tenant_id: Option<TenantId>,
    pub location_id: Option<LocationId>,
    pub below_reorder_only: bool,
    pub limit: Option<usize>,
}

pub trait OrderRepository: Send + Sync {
    fn save(&self, order: &Order) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn find_by_id(&self, id: OrderId) -> impl std::future::Future<Output = Result<Option<Order>, PortError>> + Send;
    fn find_active_by_table(
        &self,
        location_id: LocationId,
        table_id: FloorTableId,
    ) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send;
    fn find_by_shift(&self, shift_id: ShiftId) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send;
    fn query(&self, filter: &OrderFilter) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send;
}

pub trait KitchenTicketRepository: Send + Sync {
    fn save(&self, ticket: &KitchenTicket) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn find_by_id(
        &self,
        id: KitchenTicketId,
    ) -> impl std::future::Future<Output = Result<Option<KitchenTicket>, PortError>> + Send;
    fn find_active_by_station(
        &self,
        location_id: LocationId,
        station: &StationId,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send;
    fn find_by_order(
        &self,
        order_id: OrderId,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send;
    fn query(
        &self,
        filter: &TicketFilter,
    ) -> impl std::future::Future<Output = Result<Vec<KitchenTicket>, PortError>> + Send;
}

pub trait InventoryRepository: Send + Sync {
    fn save_stock_item(&self, item: &StockItem) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn find_stock_item(
        &self,
        id: StockItemId,
    ) -> impl std::future::Future<Output = Result<Option<StockItem>, PortError>> + Send;
    fn query_stock_items(
        &self,
        filter: &InventoryFilter,
    ) -> impl std::future::Future<Output = Result<Vec<StockItem>, PortError>> + Send;
    fn save_recipe(&self, recipe: &Recipe) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn find_recipe_by_menu_item(
        &self,
        menu_item_id: MenuItemId,
    ) -> impl std::future::Future<Output = Result<Option<Recipe>, PortError>> + Send;
}

#[derive(Debug, Clone)]
pub struct PrintReceiptJob {
    pub order: Order,
    pub template_id: Option<String>,
    pub header_text: Option<String>,
    pub footer_text: Option<String>,
    pub reprint: bool,
}

#[derive(Debug, Clone)]
pub struct PrintKotJob {
    pub ticket: KitchenTicket,
    pub template_id: Option<String>,
    pub station_name: String,
}

pub trait PrinterGateway: Send + Sync {
    fn print_receipt(
        &self,
        target_printer: &str,
        job: &PrintReceiptJob,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn print_kot(
        &self,
        target_printer: &str,
        job: &PrintKotJob,
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn print_raw_esc_pos(
        &self,
        target_printer: &str,
        payload: &[u8],
    ) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
}

pub trait SyncGateway: Send + Sync {
    fn dispatch_event(&self, event: &OrderEvent) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
    fn dispatch_events(&self, events: &[OrderEvent]) -> impl std::future::Future<Output = Result<(), PortError>> + Send;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use crate::ids::{StaffMemberId, TerminalId};
    use crate::enums::OrderChannel;

    #[test]
    fn test_port_error_formatting() {
        let err = PortError::NotFound {
            entity: "Order",
            id: "12345".to_string(),
        };
        assert_eq!(err.to_string(), "Entity 'Order' with id '12345' not found");

        let conflict = PortError::Conflict {
            message: "Version mismatch".to_string(),
        };
        assert_eq!(conflict.to_string(), "Conflict detected: Version mismatch");
    }

    struct MockOrderRepo {
        orders: Mutex<Vec<Order>>,
    }

    impl OrderRepository for MockOrderRepo {
        fn save(&self, order: &Order) -> impl std::future::Future<Output = Result<(), PortError>> + Send {
            let mut lock = self.orders.lock().unwrap();
            lock.retain(|o| o.id != order.id);
            lock.push(order.clone());
            std::future::ready(Ok(()))
        }

        fn find_by_id(&self, id: OrderId) -> impl std::future::Future<Output = Result<Option<Order>, PortError>> + Send {
            let lock = self.orders.lock().unwrap();
            std::future::ready(Ok(lock.iter().find(|o| o.id == id).cloned()))
        }

        fn find_active_by_table(
            &self,
            _location_id: LocationId,
            _table_id: FloorTableId,
        ) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
            let lock = self.orders.lock().unwrap();
            std::future::ready(Ok(lock.clone()))
        }

        fn find_by_shift(&self, _shift_id: ShiftId) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
            std::future::ready(Ok(vec![]))
        }

        fn query(&self, filter: &OrderFilter) -> impl std::future::Future<Output = Result<Vec<Order>, PortError>> + Send {
            let lock = self.orders.lock().unwrap();
            let mut list: Vec<Order> = lock.iter().cloned().collect();
            if let Some(status) = filter.status {
                list.retain(|o| o.status == status);
            }
            std::future::ready(Ok(list))
        }
    }

    #[tokio::test]
    async fn test_mock_order_repository_flow() {
        let repo = MockOrderRepo {
            orders: Mutex::new(Vec::new()),
        };

        let (order, _) = Order::new(
            TenantId::new(),
            LocationId::new(),
            TerminalId::new(),
            OrderChannel::DineIn,
            StaffMemberId::new(),
            None,
            None,
        );
        let id = order.id;

        assert!(repo.save(&order).await.is_ok());

        let fetched = repo.find_by_id(id).await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().id, id);
    }
}
