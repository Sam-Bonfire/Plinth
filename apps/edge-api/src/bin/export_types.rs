use std::path::PathBuf;
use specta_typescript::Typescript;
use specta::TypeCollection;

// Import all domain models and value objects
use core_domain::enums::{
    kitchen::{KitchenTicketStatus, StationId},
    order_channel::OrderChannel,
    order_status::OrderStatus,
    payment::{PaymentMethod, PaymentStatus},
    refund::{RefundReason, RefundStatus, RefundType},
    staff::{Permissions, StaffRole},
};
use core_domain::events::stock::StockAdjustmentReason;
use core_domain::ids::{
    AuditEventId, FloorTableId, KitchenTicketId, LocationId, MenuCategoryId, MenuItemId, OrderId,
    OrderLineItemId, RecipeId, RefundId, ReservationId, ShiftId, StaffMemberId, StockItemId,
    TenantId, TerminalId,
};
use core_domain::models::{
    inventory::{Recipe, RecipeIngredient, StockItem},
    kitchen::{KitchenTicket, TicketLineItem},
    order::{Order, OrderLineItem, PaymentEntry},
    shift::{CashDrawerCount, CashMovement, CashMovementType, StoreShift, ZReport},
};
use core_domain::value_objects::{
    discount::{Discount, DiscountReason, DiscountType},
    measurement::{StockQuantity, UnitOfMeasure},
    modifier::{ModifierGroup, ModifierGroupType, ModifierOption, ModifierSelection},
    money::{Currency, Money},
    order_charge::{ChargeType, OrderCharge},
    preparation::{PreparationSla, SlaStatus},
    table::{FloorSection, SeatNumber},
    tax::{GstApplicability, GstRate, TaxBreakdown, TaxComponent},
    tip::{TipAmount, TipType},
};

// Import all edge-api DTOs
use edge_api::dto::menu::{
    MenuCatalogResponseDto, MenuCategoryDto, MenuItemDto, NestedMenuCategoryDto,
    UpdateItemAvailabilityRequest,
};
use edge_api::dto::order::{
    CreateLineItemDto, CreateOrderRequest, OrderResponseDto, OrderSummaryDto, PaginatedResponse,
};
use edge_api::router::{ApiErrorResponse, HealthResponse};
use edge_api::routes::audit::{AuditResponseDto, IngestAuditRequest};
use edge_api::routes::eod::{CloseShiftRequest, ZReportDto};
use edge_api::routes::inventory::{AdjustStockRequest, InventoryQueryParams, StockItemResponseDto};
use edge_api::routes::kds::{BumpTicketRequest, KitchenTicketDto, TicketQueryParams};
use edge_api::routes::reports::SalesReportDto;

#[allow(clippy::too_many_lines)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut types = TypeCollection::default();

    // Register Domain IDs
    types.register::<TenantId>();
    types.register::<LocationId>();
    types.register::<TerminalId>();
    types.register::<OrderId>();
    types.register::<OrderLineItemId>();
    types.register::<KitchenTicketId>();
    types.register::<StockItemId>();
    types.register::<MenuItemId>();
    types.register::<MenuCategoryId>();
    types.register::<StaffMemberId>();
    types.register::<FloorTableId>();
    types.register::<ReservationId>();
    types.register::<ShiftId>();
    types.register::<RefundId>();
    types.register::<RecipeId>();
    types.register::<AuditEventId>();

    // Register Enums
    types.register::<OrderChannel>();
    types.register::<OrderStatus>();
    types.register::<PaymentMethod>();
    types.register::<PaymentStatus>();
    types.register::<StationId>();
    types.register::<KitchenTicketStatus>();
    types.register::<GstRate>();
    types.register::<GstApplicability>();
    types.register::<RefundReason>();
    types.register::<RefundType>();
    types.register::<RefundStatus>();
    types.register::<StaffRole>();
    types.register::<Permissions>();
    types.register::<StockAdjustmentReason>();
    types.register::<UnitOfMeasure>();
    types.register::<ChargeType>();
    types.register::<TipType>();
    types.register::<DiscountReason>();
    types.register::<SlaStatus>();
    types.register::<CashMovementType>();

    // Register Value Objects
    types.register::<Currency>();
    types.register::<Money>();
    types.register::<TaxBreakdown>();
    types.register::<TaxComponent>();
    types.register::<StockQuantity>();
    types.register::<DiscountType>();
    types.register::<Discount>();
    types.register::<OrderCharge>();
    types.register::<TipAmount>();
    types.register::<ModifierOption>();
    types.register::<ModifierGroupType>();
    types.register::<ModifierGroup>();
    types.register::<ModifierSelection>();
    types.register::<PreparationSla>();
    types.register::<SeatNumber>();
    types.register::<FloorSection>();

    // Register Domain Models
    types.register::<OrderLineItem>();
    types.register::<PaymentEntry>();
    types.register::<Order>();
    types.register::<TicketLineItem>();
    types.register::<KitchenTicket>();
    types.register::<StockItem>();
    types.register::<RecipeIngredient>();
    types.register::<Recipe>();
    types.register::<CashMovement>();
    types.register::<CashDrawerCount>();
    types.register::<StoreShift>();
    types.register::<ZReport>();

    // Register API DTOs
    types.register::<MenuCategoryDto>();
    types.register::<MenuItemDto>();
    types.register::<NestedMenuCategoryDto>();
    types.register::<MenuCatalogResponseDto>();
    types.register::<UpdateItemAvailabilityRequest>();

    types.register::<CreateLineItemDto>();
    types.register::<CreateOrderRequest>();
    types.register::<OrderResponseDto>();
    types.register::<OrderSummaryDto>();
    types.register::<PaginatedResponse<OrderSummaryDto>>();

    types.register::<TicketQueryParams>();
    types.register::<BumpTicketRequest>();
    types.register::<KitchenTicketDto>();

    types.register::<InventoryQueryParams>();
    types.register::<AdjustStockRequest>();
    types.register::<StockItemResponseDto>();

    types.register::<IngestAuditRequest>();
    types.register::<AuditResponseDto>();

    types.register::<CloseShiftRequest>();
    types.register::<ZReportDto>();

    types.register::<SalesReportDto>();
    types.register::<ApiErrorResponse>();
    types.register::<HealthResponse>();

    let mut output_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    output_path.pop(); // to apps
    output_path.pop(); // to workspace root
    output_path.push("packages");
    output_path.push("ui-kit");
    output_path.push("src");
    output_path.push("api");
    output_path.push("generated");
    output_path.push("types.ts");

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    Typescript::default()
        .bigint(specta_typescript::BigIntExportBehavior::Number)
        .export_to(&output_path, &types)?;

    println!("Successfully exported TypeScript types to: {}", output_path.display());
    Ok(())
}
