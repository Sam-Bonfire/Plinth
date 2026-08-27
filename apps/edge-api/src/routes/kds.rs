use core_domain::{
    enums::kitchen::{KitchenTicketStatus, StationId},
    ids::{KitchenTicketId, LocationId, MenuItemId, OrderId, OrderLineItemId, StaffMemberId, TenantId},
    models::kitchen::{KitchenTicket, TicketLineItem},
    value_objects::modifier::ModifierSelection,
    value_objects::preparation::{PreparationSla, SlaStatus},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use worker::{
    wasm_bindgen::JsValue,
    Error, Request, Response, Result, RouteContext, Router,
};

/// Query parameters for filtering KDS tickets
#[derive(Debug, Deserialize, Default)]
pub struct TicketQueryParams {
    pub station: Option<String>,
    pub status: Option<String>,
}

/// Request payload for bumping an active kitchen ticket
#[derive(Debug, Deserialize)]
pub struct BumpTicketRequest {
    pub bumped_by: Option<StaffMemberId>,
}

/// Kitchen ticket presentation DTO with dynamic SLA status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitchenTicketDto {
    #[serde(flatten)]
    pub ticket: KitchenTicket,
    pub sla_status: SlaStatus,
}

#[derive(Debug, Deserialize)]
struct RawTicketRow {
    id: String,
    order_id: String,
    tenant_id: String,
    location_id: String,
    station: String,
    kot_number: u32,
    status: String,
    sla_warning_sec: u64,
    sla_late_sec: u64,
    created_at: String,
    bumped_at: Option<String>,
    bumped_by: Option<String>,
    cancelled_at: Option<String>,
    cancellation_reason: Option<String>,
    items_json: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawLineItemJson {
    line_item_id: String,
    menu_item_id: String,
    name: String,
    quantity: u32,
    modifiers: Option<Vec<ModifierSelection>>,
    special_instructions: Option<String>,
}

impl TryFrom<RawTicketRow> for KitchenTicket {
    type Error = worker::Error;

    fn try_from(row: RawTicketRow) -> Result<Self> {
        let items: Vec<TicketLineItem> = if let Some(ref json_str) = row.items_json {
            let raw_items: Vec<RawLineItemJson> = serde_json::from_str(json_str)
                .map_err(|e| Error::RustError(format!("Failed to parse line items JSON: {e}")))?;

            raw_items
                .into_iter()
                .map(|item| -> Result<TicketLineItem> {
                    let line_item_id = item
                        .line_item_id
                        .parse::<uuid::Uuid>()
                        .map(OrderLineItemId::from)
                        .map_err(|_| Error::RustError("Invalid line_item_id UUID".into()))?;

                    let menu_item_id = item
                        .menu_item_id
                        .parse::<uuid::Uuid>()
                        .map(MenuItemId::from)
                        .map_err(|_| Error::RustError("Invalid menu_item_id UUID".into()))?;

                    Ok(TicketLineItem {
                        line_item_id,
                        menu_item_id,
                        name: item.name,
                        quantity: item.quantity,
                        modifiers: item.modifiers.unwrap_or_default(),
                        special_instructions: item.special_instructions,
                    })
                })
                .collect::<Result<Vec<TicketLineItem>>>()?
        } else {
            Vec::new()
        };

        let status = match row.status.as_str() {
            "Pending" => KitchenTicketStatus::Pending,
            "InPrep" => KitchenTicketStatus::InPrep,
            "Ready" => KitchenTicketStatus::Ready,
            "Bumped" => KitchenTicketStatus::Bumped,
            "Cancelled" => KitchenTicketStatus::Cancelled,
            other => return Err(Error::RustError(format!("Unknown ticket status: {other}"))),
        };

        let station = match row.station.as_str() {
            "Grill" => StationId::Grill,
            "Tandoor" => StationId::Tandoor,
            "MainKitchen" => StationId::MainKitchen,
            "ColdStation" => StationId::ColdStation,
            "Beverages" => StationId::Beverages,
            "Desserts" => StationId::Desserts,
            other => StationId::Custom(other.to_string()),
        };

        let sla = PreparationSla {
            threshold_warning: Duration::from_secs(row.sla_warning_sec),
            threshold_late: Duration::from_secs(row.sla_late_sec),
        };

        let created_at = DateTime::parse_from_rfc3339(&row.created_at)
            .map_or_else(
                |_| Utc::now(),
                |dt: DateTime<chrono::FixedOffset>| dt.with_timezone(&Utc),
            );

        let bumped_at = row.bumped_at.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt: DateTime<chrono::FixedOffset>| dt.with_timezone(&Utc))
        });

        let cancelled_at = row.cancelled_at.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt: DateTime<chrono::FixedOffset>| dt.with_timezone(&Utc))
        });

        let bumped_by = row
            .bumped_by
            .and_then(|s| s.parse::<uuid::Uuid>().ok().map(StaffMemberId::from));

        Ok(KitchenTicket {
            id: row
                .id
                .parse::<uuid::Uuid>()
                .map(KitchenTicketId::from)
                .map_err(|_| Error::RustError("Invalid ticket ID".into()))?,
            order_id: row
                .order_id
                .parse::<uuid::Uuid>()
                .map(OrderId::from)
                .map_err(|_| Error::RustError("Invalid order ID".into()))?,
            tenant_id: row
                .tenant_id
                .parse::<uuid::Uuid>()
                .map(TenantId::from)
                .map_err(|_| Error::RustError("Invalid tenant ID".into()))?,
            location_id: row
                .location_id
                .parse::<uuid::Uuid>()
                .map(LocationId::from)
                .map_err(|_| Error::RustError("Invalid location ID".into()))?,
            station,
            kot_number: row.kot_number,
            items,
            status,
            sla,
            created_at,
            bumped_at,
            bumped_by,
            cancelled_at,
            cancellation_reason: row.cancellation_reason,
        })
    }
}

/// Registers the KDS routing endpoints
#[must_use]
pub fn register<'a, D: 'a>(router: Router<'a, D>) -> Router<'a, D> {
    router
        .get_async("/api/v1/kds/tickets", list_active_tickets)
        .post_async("/api/v1/kds/tickets/:id/bump", bump_ticket)
}

/// Lists active tickets sorted by age with computed SLAs
///
/// # Errors
/// Returns an error if the database query fails or authentication context is missing
pub async fn list_active_tickets<D>(req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        "",
        core_domain::enums::staff::Permissions::empty(),
    ) else {
        return Response::error("Unauthorized", 401);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let url = req.url()?;
    let query_params: std::collections::HashMap<String, String> =
        url.query_pairs().into_owned().collect();

    let station = query_params.get("station");
    let status = query_params.get("status");

    let mut base_query = String::from(
        "SELECT
            t.id, t.order_id, t.tenant_id, t.location_id, t.station, t.kot_number,
            t.status, t.sla_warning_sec, t.sla_late_sec, t.created_at, t.bumped_at,
            t.bumped_by, t.cancelled_at, t.cancellation_reason,
            COALESCE(
                json_group_array(
                    json_object(
                        'line_item_id', i.line_item_id,
                        'menu_item_id', i.menu_item_id,
                        'name', i.name,
                        'quantity', i.quantity,
                        'modifiers', json(i.modifiers_json),
                        'special_instructions', i.special_instructions
                    )
                ) FILTER (WHERE i.line_item_id IS NOT NULL),
                '[]'
            ) as items_json
         FROM kitchen_tickets t
         LEFT JOIN ticket_line_items i ON t.id = i.ticket_id
         WHERE t.tenant_id = ? AND t.location_id = ?",
    );

    let mut bind_params: Vec<JsValue> = vec![
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    if let Some(s) = station {
        base_query.push_str(" AND t.station = ?");
        bind_params.push(s.clone().into());
    }

    if let Some(st) = status {
        base_query.push_str(" AND t.status = ?");
        bind_params.push(st.clone().into());
    } else {
        base_query.push_str(" AND t.status IN ('Pending', 'InPrep', 'Ready')");
    }

    base_query.push_str(" GROUP BY t.id ORDER BY t.created_at ASC");

    let stmt = db.prepare(&base_query);
    let bind_stmt = stmt.bind(&bind_params)?;

    let result = bind_stmt.all().await?;
    let rows: Vec<RawTicketRow> = result.results()?;

    let now = Utc::now();
    let mut ticket_dtos = Vec::with_capacity(rows.len());

    for row in rows {
        let ticket = KitchenTicket::try_from(row)?;
        let sla_status = ticket.sla_status(now);
        ticket_dtos.push(KitchenTicketDto { ticket, sla_status });
    }

    Response::from_json(&ticket_dtos)
}

/// Bumps a ticket to the next lifecycle state
///
/// # Errors
/// Returns an error if the ticket is not found, state transition is invalid, or database update fails
pub async fn bump_ticket<D>(mut req: Request, ctx: RouteContext<D>) -> Result<Response> {
    let Ok(tenant_ctx) = crate::auth::extract_and_verify_context(
        &req,
        "",
        core_domain::enums::staff::Permissions::empty(),
    ) else {
        return Response::error("Unauthorized", 401);
    };

    let db = match ctx.env.d1("CELLAR_DB") {
        Ok(db) => db,
        Err(e) => return Response::error(format!("Database error: {e}"), 500),
    };

    let Some(ticket_id_str) = ctx.param("id") else {
        return Response::error("Missing ticket ID", 400);
    };

    let body_res = req.json::<BumpTicketRequest>().await;
    let bumped_by = body_res.ok().and_then(|b| b.bumped_by);

    let query = "SELECT
            t.id, t.order_id, t.tenant_id, t.location_id, t.station, t.kot_number,
            t.status, t.sla_warning_sec, t.sla_late_sec, t.created_at, t.bumped_at,
            t.bumped_by, t.cancelled_at, t.cancellation_reason,
            COALESCE(
                json_group_array(
                    json_object(
                        'line_item_id', i.line_item_id,
                        'menu_item_id', i.menu_item_id,
                        'name', i.name,
                        'quantity', i.quantity,
                        'modifiers', json(i.modifiers_json),
                        'special_instructions', i.special_instructions
                    )
                ) FILTER (WHERE i.line_item_id IS NOT NULL),
                '[]'
            ) as items_json
         FROM kitchen_tickets t
         LEFT JOIN ticket_line_items i ON t.id = i.ticket_id
         WHERE t.id = ? AND t.tenant_id = ? AND t.location_id = ?
         GROUP BY t.id";

    let bind_params: Vec<JsValue> = vec![
        ticket_id_str.clone().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    let stmt = db.prepare(query);
    let bind_stmt = stmt.bind(&bind_params)?;

    let result = bind_stmt.all().await?;
    let rows: Vec<RawTicketRow> = result.results()?;

    let Some(row) = rows.into_iter().next() else {
        return Response::error("Ticket not found", 404);
    };

    let mut ticket = KitchenTicket::try_from(row)?;

    if ticket.bump(bumped_by).is_err() {
        return Response::error("Ticket is already completed or cancelled", 409);
    }

    let status_str = match ticket.status {
        KitchenTicketStatus::Pending => "Pending",
        KitchenTicketStatus::InPrep => "InPrep",
        KitchenTicketStatus::Ready => "Ready",
        KitchenTicketStatus::Cancelled => "Cancelled",
        _ => "Bumped",
    };

    let update_query = "UPDATE kitchen_tickets SET status = ?, bumped_at = ?, bumped_by = ? WHERE id = ? AND tenant_id = ? AND location_id = ?";
    let update_params: Vec<JsValue> = vec![
        status_str.into(),
        ticket
            .bumped_at
            .map_or(JsValue::null(), |t| t.to_rfc3339().into()),
        ticket
            .bumped_by
            .map_or(JsValue::null(), |id| id.to_string().into()),
        ticket.id.to_string().into(),
        tenant_ctx.tenant_id.to_string().into(),
        tenant_ctx.location_id.to_string().into(),
    ];

    let update_stmt = db.prepare(update_query);
    let bound_update = update_stmt.bind(&update_params)?;
    let _ = bound_update.run().await?;

    let now = Utc::now();
    let dto = KitchenTicketDto {
        sla_status: ticket.sla_status(now),
        ticket,
    };

    Response::from_json(&dto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::{
        enums::kitchen::{KitchenTicketStatus, StationId},
        ids::{LocationId, OrderId, TenantId},
        models::kitchen::KitchenTicket,
        value_objects::preparation::PreparationSla,
    };

    #[test]
    fn test_list_active_tickets_json_structure() {
        let sla = PreparationSla::default_restaurant();
        let (ticket, _event) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            1,
            vec![],
            sla,
        );
        let now = Utc::now();
        let dto = KitchenTicketDto {
            sla_status: ticket.sla_status(now),
            ticket,
        };

        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("Grill"));
        assert!(json.contains("Pending"));
    }

    #[test]
    fn test_bump_ticket_invalid_state_transition() {
        let sla = PreparationSla::default_restaurant();
        let (mut ticket, _) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            1,
            vec![],
            sla,
        );

        assert!(ticket.bump(None).is_ok());
        assert_eq!(ticket.status, KitchenTicketStatus::Bumped);

        let result = ticket.bump(None);
        assert!(result.is_err());
    }

    #[test]
    fn test_sla_status_evaluation() {
        let sla = PreparationSla {
            threshold_warning: Duration::from_mins(4),
            threshold_late: Duration::from_mins(8),
        };
        let (ticket, _) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::MainKitchen,
            42,
            vec![],
            sla,
        );

        // Immediate check -> OnTime
        assert_eq!(ticket.sla_status(ticket.created_at), SlaStatus::OnTime);

        // 5 minutes later -> Warning (between 4m and 8m)
        let warning_time = ticket.created_at + chrono::Duration::seconds(300);
        assert_eq!(ticket.sla_status(warning_time), SlaStatus::Warning);

        // 10 minutes later -> Late (>= 8m)
        let late_time = ticket.created_at + chrono::Duration::seconds(600);
        assert_eq!(ticket.sla_status(late_time), SlaStatus::Late);
    }
}
