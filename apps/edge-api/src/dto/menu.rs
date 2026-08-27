use core_domain::{
    enums::kitchen::StationId,
    ids::{MenuCategoryId, MenuItemId},
    value_objects::tax::GstRate,
};
use serde::{Deserialize, Serialize};

/// Flat category representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuCategoryDto {
    pub id: MenuCategoryId,
    pub name: String,
    pub display_order: u16,
    pub is_active: bool,
}

/// Menu item representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuItemDto {
    pub id: MenuItemId,
    pub primary_category_id: MenuCategoryId,
    pub name: String,
    pub description: Option<String>,
    pub price_minor: i64,
    pub tax_rate: GstRate,
    pub is_veg: bool,
    pub is_available: bool,
    pub sku: Option<String>,
    pub kitchen_station: StationId,
}

/// Nested category containing child menu items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NestedMenuCategoryDto {
    pub id: MenuCategoryId,
    pub name: String,
    pub display_order: u16,
    pub is_active: bool,
    pub items: Vec<MenuItemDto>,
}

/// Full menu catalog response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuCatalogResponseDto {
    pub categories: Vec<NestedMenuCategoryDto>,
}

/// Request to toggle item availability (86 toggle)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateItemAvailabilityRequest {
    pub is_available: bool,
    pub reason: Option<String>,
}
