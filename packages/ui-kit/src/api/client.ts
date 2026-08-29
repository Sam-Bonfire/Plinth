import type {
  AdjustStockRequest,
  ApiErrorResponse,
  AuditResponseDto,
  BumpTicketRequest,
  CloseShiftRequest,
  CreateOrderRequest,
  HealthResponse,
  IngestAuditRequest,
  InventoryQueryParams,
  KitchenTicketDto,
  KitchenTicketId,
  MenuCatalogResponseDto,
  MenuItemDto,
  MenuItemId,
  OrderChannel,
  OrderResponseDto,
  OrderStatus,
  OrderSummaryDto,
  PaginatedResponse,
  SalesReportDto,
  StockItemResponseDto,
  TicketQueryParams,
  UpdateItemAvailabilityRequest,
  ZReportDto,
} from "./generated/types.js";

/**
 * Structured API Error capturing HTTP status code and server error envelope.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;

  constructor(
    message: string,
    status: number,
    code: string = "API_ERROR",
    requestId: string = "",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  token?: string | null;
  tenantId?: string | null;
  locationId?: string | null;
  fetchFn?: typeof globalThis.fetch;
}

export interface ListOrdersParams {
  status?: OrderStatus;
  channel?: OrderChannel;
  terminal_id?: string;
  table_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface SalesReportParams {
  period?: "today" | "yesterday" | string;
  date_from?: string;
  date_to?: string;
}

/**
 * Strongly-typed HTTP Client for PlinthOS API.
 */
export class PlinthApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
    };
  }

  public setToken(token: string | null): void {
    this.config.token = token;
  }

  public setTenantContext(tenantId: string | null, locationId: string | null): void {
    this.config.tenantId = tenantId;
    this.config.locationId = locationId;
  }

  private getFetch(): typeof globalThis.fetch {
    if (this.config.fetchFn) {
      return this.config.fetchFn;
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
      return globalThis.fetch.bind(globalThis);
    }
    throw new Error("No fetch implementation available in current environment");
  }

  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...customHeaders,
    };

    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    if (this.config.tenantId) {
      headers["x-tenant-id"] = this.config.tenantId;
    }
    if (this.config.locationId) {
      headers["x-location-id"] = this.config.locationId;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const fetchImpl = this.getFetch();
    let url = `${this.config.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    const headers = this.buildHeaders();
    const reqInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && method !== "GET") {
      reqInit.body = JSON.stringify(body);
    }

    const response = await fetchImpl(url, reqInit);

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status} ${response.statusText}`;
      let errorCode = "HTTP_ERROR";
      let requestId = response.headers.get("x-request-id") ?? "";

      try {
        const errorJson = (await response.json()) as Partial<ApiErrorResponse>;
        if (errorJson && typeof errorJson.error === "string") {
          errorMessage = errorJson.error;
        }
        if (errorJson && typeof errorJson.code === "string") {
          errorCode = errorJson.code;
        }
        if (errorJson && typeof errorJson.request_id === "string") {
          requestId = errorJson.request_id;
        }
      } catch {
        // Non-JSON error body fallback
        try {
          const text = await response.text();
          if (text) {
            errorMessage = text;
          }
        } catch {
          // Ignore text parsing errors
        }
      }

      throw new ApiError(errorMessage, response.status, errorCode, requestId);
    }

    return (await response.json()) as T;
  }

  // --- Health Endpoint ---
  public async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", "GET");
  }

  // --- Auth Endpoint ---
  public async login(
    req: { staff_id: string; pin: string; role?: string },
  ): Promise<{ token: string; staff_id: string; role: string; permissions: number; expires_in: number }> {
    const res = await this.request<{
      token: string;
      staff_id: string;
      role: string;
      permissions: number;
      expires_in: number;
    }>("/api/v1/auth/login", "POST", req);
    this.setToken(res.token);
    return res;
  }

  // --- Orders Endpoints ---
  public async createOrder(orderReq: CreateOrderRequest): Promise<OrderResponseDto> {
    return this.request<OrderResponseDto>("/api/v1/orders", "POST", orderReq);
  }

  public async listOrders(
    params?: ListOrdersParams,
  ): Promise<PaginatedResponse<OrderSummaryDto>> {
    return this.request<PaginatedResponse<OrderSummaryDto>>(
      "/api/v1/orders",
      "GET",
      undefined,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  }

  // --- Menu Catalog Endpoints ---
  public async getMenuCatalog(): Promise<MenuCatalogResponseDto> {
    return this.request<MenuCatalogResponseDto>("/api/v1/menu", "GET");
  }

  public async updateItemAvailability(
    itemId: MenuItemId,
    req: UpdateItemAvailabilityRequest,
  ): Promise<MenuItemDto> {
    return this.request<MenuItemDto>(
      `/api/v1/menu/items/${encodeURIComponent(itemId)}/availability`,
      "PATCH",
      req,
    );
  }

  // --- Kitchen Display System (KDS) Endpoints ---
  public async listKitchenTickets(
    params?: TicketQueryParams,
  ): Promise<KitchenTicketDto[]> {
    return this.request<KitchenTicketDto[]>(
      "/api/v1/kds/tickets",
      "GET",
      undefined,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  }

  public async bumpTicket(
    ticketId: KitchenTicketId,
    req?: BumpTicketRequest,
  ): Promise<KitchenTicketDto> {
    return this.request<KitchenTicketDto>(
      `/api/v1/kds/tickets/${encodeURIComponent(ticketId)}/bump`,
      "POST",
      req ?? { bumped_by: null },
    );
  }

  // --- Inventory Endpoints ---
  public async getInventory(
    params?: InventoryQueryParams,
  ): Promise<StockItemResponseDto[]> {
    return this.request<StockItemResponseDto[]>(
      "/api/v1/inventory",
      "GET",
      undefined,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  }

  public async adjustStock(
    req: AdjustStockRequest,
  ): Promise<{ item: StockItemResponseDto }> {
    return this.request<{ item: StockItemResponseDto }>(
      "/api/v1/inventory/adjust",
      "POST",
      req,
    );
  }

  // --- Audit Ingestion Endpoint ---
  public async ingestAudit(req: IngestAuditRequest): Promise<AuditResponseDto> {
    return this.request<AuditResponseDto>("/api/v1/audit", "POST", req);
  }

  // --- End of Day (EOD) Shift Closure Endpoint ---
  public async closeShift(req: CloseShiftRequest): Promise<ZReportDto> {
    return this.request<ZReportDto>("/api/v1/eod/close", "POST", req);
  }

  // --- Sales Reports Endpoint ---
  public async getSalesReport(params?: SalesReportParams): Promise<SalesReportDto> {
    return this.request<SalesReportDto>(
      "/api/v1/reports/sales",
      "GET",
      undefined,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  }
}
