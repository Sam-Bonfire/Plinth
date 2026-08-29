import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlinthApiClient, ApiError } from "./client.js";
import type {
  CreateOrderRequest,
  OrderResponseDto,
  PaginatedResponse,
  OrderSummaryDto,
  MenuItemDto,
  KitchenTicketDto,
  StockItemResponseDto,
  AuditResponseDto,
  ZReportDto,
  HealthResponse,
} from "./generated/types.js";

describe("PlinthApiClient Contract and Wire Verification", () => {
  const baseUrl = "https://api.plinth.local";
  const tenantId = "tenant-001";
  const locationId = "loc-99";
  const token = "jwt-test-token-xyz";

  let client: PlinthApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new PlinthApiClient({
      baseUrl,
      token,
      tenantId,
      locationId,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends health probe to /health and returns parsed response", async () => {
    const mockHealth: HealthResponse = {
      status: "ok",
      timestamp: 1724850000,
      version: "0.1.0",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHealth,
      headers: new Headers({ "x-request-id": "req-1" }),
    });

    const res = await client.getHealth();
    expect(res.status).toBe("ok");
    expect(res.version).toBe("0.1.0");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.plinth.local/health",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
          "x-location-id": locationId,
        }),
      }),
    );
  });

  it("serializes createOrder request payload and sets headers accurately", async () => {
    const orderReq: CreateOrderRequest = {
      channel: "DineIn",
      terminal_id: "term-1",
      table_id: "table-4",
      seat_number: 2,
      items: [
        {
          menu_item_id: "item-101",
          name: "Butter Chicken",
          unit_price_minor: 45000,
          quantity: 2,
          tax_rate: "FivePercent",
          modifiers: [],
          notes: "Extra spicy",
          seat_number: 2,
        },
      ],
      discounts: [],
      charges: [],
      tip: null,
    };

    const mockResponse: OrderResponseDto = {
      order: {
        id: "order-999",
        tenant_id: tenantId,
        location_id: locationId,
        terminal_id: "term-1",
        channel: "DineIn",
        status: "Confirmed",
        table_id: "table-4",
        seat_number: 2,
        items: [],
        discounts: [],
        charges: [],
        tip: null,
        payments: [],
        split_from: null,
        created_by: "staff-1",
        created_at: "2026-08-28T12:00:00Z",
        updated_at: "2026-08-28T12:00:00Z",
        deleted_at: null,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockResponse,
      headers: new Headers({ "x-request-id": "req-2" }),
    });

    const res = await client.createOrder(orderReq);
    expect(res.order.id).toBe("order-999");
    expect(res.order.status).toBe("Confirmed");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.plinth.local/api/v1/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(orderReq),
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
          "x-location-id": locationId,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("formats query strings correctly for listOrders", async () => {
    const mockList: PaginatedResponse<OrderSummaryDto> = {
      page: 1,
      page_size: 10,
      total_records: 1,
      total_pages: 1,
      data: [
        {
          id: "order-999",
          status: "Confirmed",
          channel: "DineIn",
          terminal_id: "term-1",
          table_id: "table-4",
          grand_total_minor: 94500,
          balance_due_minor: 94500,
          created_at: "2026-08-28T12:00:00Z",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockList,
      headers: new Headers(),
    });

    const res = await client.listOrders({
      status: "Confirmed",
      channel: "DineIn",
      page: 1,
      page_size: 10,
    });

    expect(res.data.length).toBe(1);
    expect(res.data[0].grand_total_minor).toBe(94500);

    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(callUrl).toContain("/api/v1/orders?");
    expect(callUrl).toContain("status=Confirmed");
    expect(callUrl).toContain("channel=DineIn");
    expect(callUrl).toContain("page=1");
    expect(callUrl).toContain("page_size=10");
  });

  it("handles updateItemAvailability patch requests", async () => {
    const mockItem: MenuItemDto = {
      id: "item-101",
      primary_category_id: "cat-1",
      name: "Butter Chicken",
      description: null,
      price_minor: 45000,
      tax_rate: "FivePercent",
      is_veg: false,
      is_available: false,
      sku: "BC-01",
      kitchen_station: "MainKitchen",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockItem,
      headers: new Headers(),
    });

    const res = await client.updateItemAvailability("item-101", {
      is_available: false,
      reason: "86 item - sold out",
    });

    expect(res.is_available).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.plinth.local/api/v1/menu/items/item-101/availability",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ is_available: false, reason: "86 item - sold out" }),
      }),
    );
  });

  it("handles KDS ticket listing and bump operations", async () => {
    const mockTickets: KitchenTicketDto[] = [
      {
        id: "ticket-1",
        order_id: "order-1",
        tenant_id: tenantId,
        location_id: locationId,
        station: "Grill",
        kot_number: 42,
        items: [],
        status: "Pending",
        sla: { threshold_warning: { secs: 240, nanos: 0 }, threshold_late: { secs: 480, nanos: 0 } },
        created_at: "2026-08-28T12:00:00Z",
        bumped_at: null,
        bumped_by: null,
        cancelled_at: null,
        cancellation_reason: null,
        sla_status: "OnTime",
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTickets,
      headers: new Headers(),
    });

    const tickets = await client.listKitchenTickets({ station: "Grill" });
    expect(tickets.length).toBe(1);
    expect(tickets[0].station).toBe("Grill");
    expect(tickets[0].sla_status).toBe("OnTime");

    // Bump ticket
    const bumpedTicket: KitchenTicketDto = {
      ...mockTickets[0],
      status: "Bumped",
      bumped_at: "2026-08-28T12:05:00Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => bumpedTicket,
      headers: new Headers(),
    });

    const bumped = await client.bumpTicket("ticket-1", { bumped_by: "staff-9" });
    expect(bumped.status).toBe("Bumped");
  });

  it("handles stock adjustment and inventory queries", async () => {
    const mockStock: StockItemResponseDto[] = [
      {
        id: "stock-1",
        name: "Mozzarella",
        unit: "Kilogram",
        current_quantity: "15.5",
        par_level: "30",
        reorder_level: "10",
        cost_per_unit: { amount: "400", currency: "Inr" },
        is_active: true,
        is_below_reorder: false,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStock,
      headers: new Headers(),
    });

    const stock = await client.getInventory({ below_reorder: false });
    expect(stock.length).toBe(1);
    expect(stock[0].current_quantity).toBe("15.5");

    // Adjust stock
    const adjustRes = {
      item: {
        ...mockStock[0],
        current_quantity: "25.5",
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => adjustRes,
      headers: new Headers(),
    });

    const adjusted = await client.adjustStock({
      stock_item_id: "stock-1",
      delta: "10",
      reason: "PurchaseReceived",
      notes: "Invoice #9001",
    });

    expect(adjusted.item.current_quantity).toBe("25.5");
  });

  it("handles audit log ingestion and EOD shift closure", async () => {
    const auditRes: AuditResponseDto = {
      success: true,
      event_id: "audit-123",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => auditRes,
      headers: new Headers(),
    });

    const audit = await client.ingestAudit({
      action: "MANAGER_DISCOUNT",
      target_type: "Order",
      target_id: "order-99",
      payload_json: null,
      is_anomaly: false,
    });
    expect(audit.success).toBe(true);

    // EOD Close Shift
    const zReport: ZReportDto = {
      shift_id: "shift-1",
      gross_sales: 150000,
      net_sales: 135000,
      total_tax: 15000,
      total_discounts: 5000,
      total_charges: 0,
      tender_breakdown: [["Cash", 50000], ["UPI", 100000]],
      physical_cash: 52000,
      expected_cash: 50000,
      variance: 2000,
      closed_at: "2026-08-28T22:00:00Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => zReport,
      headers: new Headers(),
    });

    const shift = await client.closeShift({
      shift_id: "shift-1",
      physical_cash_minor: 52000,
      notes: "Safe count verified",
    });

    expect(shift.variance).toBe(2000);
    expect(shift.gross_sales).toBe(150000);
  });

  it("throws ApiError with status, error code, and request id on structured 401 error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "x-request-id": "req-unauth-99" }),
      json: async () => ({
        error: "Missing x-tenant-id header",
        code: "UNAUTHORIZED",
        request_id: "req-unauth-99",
      }),
    });

    await expect(client.getMenuCatalog()).rejects.toThrow(ApiError);

    try {
      await client.getMenuCatalog();
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.code).toBe("UNAUTHORIZED");
      expect(apiErr.message).toBe("Missing x-tenant-id header");
      expect(apiErr.requestId).toBe("req-unauth-99");
    }
  });

  it("throws ApiError on 403 Forbidden with insufficient permissions", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: new Headers({ "x-request-id": "req-forbid-1" }),
      json: async () => ({
        error: "Insufficient permissions",
        code: "FORBIDDEN",
        request_id: "req-forbid-1",
      }),
    });

    try {
      await client.closeShift({ shift_id: "shift-1", physical_cash_minor: 1000, notes: null });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe("FORBIDDEN");
      expect(apiErr.message).toBe("Insufficient permissions");
    }
  });

  it("handles non-JSON error responses gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      headers: new Headers(),
      json: async () => {
        throw new Error("Invalid JSON");
      },
      text: async () => "Cloudflare 502 Bad Gateway",
    });

    try {
      await client.getHealth();
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.message).toBe("Cloudflare 502 Bad Gateway");
    }
  });
});
