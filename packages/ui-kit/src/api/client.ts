import type {
  AdjustStockRequest,
  ApiErrorResponse,
  AuditEventDto,
  AuditListResponse,
  AuditResponseDto,
  BumpTicketRequest,
  CloseShiftRequest,
  CreateOrderRequest,
  CreateStaffRequest,
  HealthResponseDto,
  IngestAuditRequest,
  InventoryQueryParams,
  KitchenTicketDto,
  KitchenTicketId,
  ListStaffResponse,
  MenuCatalogResponseDto,
  MenuItemDto,
  MenuItemId,
  MessBalanceResponse,
  MessLedgerResponse,
  MessPayRequest,
  MessTopUpRequest,
  OpenShiftRequest,
  OpenShiftResponse,
  OrderChannel,
  OrderResponseDto,
  OrderStatus,
  OrderStatusResponseDto,
  OrderSummaryDto,
  PaginatedResponse,
  PinVerifyRequest,
  PinVerifyResponse,
  RefundRequest,
  RefundResponse,
  StaffResponseDto,
  UpdateStaffRequest,
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
  tenantId?: string | null;
  locationId?: string | null;
  fetchFn?: typeof globalThis.fetch;
}

/**
 * Staff session state. Tokens are never part of this shape: they live in
 * HttpOnly cookies the browser sends automatically.
 */
export interface StaffSessionDto {
  staff_id: string;
  role: string;
  permissions: number;
  expires_in: number;
  tenant_id?: string;
  location_id?: string;
}

/** Customer session state, also credential-free. */
export interface CustomerSessionDto {
  customer_id: string;
  tenant_id: string;
  location_id: string;
  expires_in: number;
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

export interface MenuSyncRequest {
  platforms: string[];
  menu_version: string;
  item_count: number;
}

export interface MenuSyncRun {
  id: string;
  platform: string;
  status: string;
}

export interface MenuSyncResponse {
  success: boolean;
  runs: MenuSyncRun[];
}

export interface PublicTenantDto {
  id: string;
  slug: string;
  name: string;
}

export interface PublicMenuItemDto {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  is_veg: boolean;
}

export interface PublicMenuCategoryDto {
  id: string;
  name: string;
  items: PublicMenuItemDto[];
}

export interface PublicMenuCatalogResponseDto {
  categories: PublicMenuCategoryDto[];
}

export interface PublicOrderItemDto {
  menu_item_id: string;
  name: string;
  unit_price_minor: number;
  quantity: number;
  tax_rate?: string | null;
  notes?: string | null;
}

export interface CreatePublicOrderRequest {
  tenant_id: string;
  location_id: string;
  channel: string;
  customer_name?: string | null;
  items: PublicOrderItemDto[];
}

export interface PublicOrderResponseDto {
  success: boolean;
  order_id: string;
  ticket_id: string;
  total_minor: number;
}

export interface PublicOrderStatusResponseDto {
  order_id: string;
  status: string;
}

export interface CustomerLoginRequest {
  tenant_id: string;
  phone: string;
}

export interface CustomerProfileDto {
  id?: string;
  tenant_id?: string;
  location_id?: string;
  name: string;
  phone: string;
  email?: string | null;
  loyalty_points?: number;
}

export interface CustomerLoginResponseDto {
  customer: CustomerProfileDto;
  expires_in?: number;
}

export interface CustomerRegisterRequest {
  tenant_id: string;
  location_id: string;
  name: string;
  phone: string;
  email?: string | null;
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
    allowRefresh = true,
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
      // Session cookies are the only credential store: page scripts never see a token.
      credentials: "include",
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

      const isSessionEndpoint = endpoint.startsWith("/api/v1/auth") || endpoint.startsWith("/api/v1/customer-auth");
      if (response.status === 401 && allowRefresh && !isSessionEndpoint) {
        try {
          await this.refreshSession();
          return await this.request<T>(endpoint, method, body, params, false);
        } catch {
          // Refresh failed: surface the original 401 below.
        }
      }

      throw new ApiError(errorMessage, response.status, errorCode, requestId);
    }

    return (await response.json()) as T;
  }

  // --- Health Endpoint ---
  public async getHealth(): Promise<HealthResponseDto> {
    return this.request<HealthResponseDto>("/health", "GET");
  }

  // --- Auth Endpoints ---
  // Session tokens live in HttpOnly cookies; these methods only exchange and
  // describe session state. The role always comes from the stored staff row.
  public async login(
    req: { staff_id: string; pin: string },
  ): Promise<StaffSessionDto> {
    return this.request<StaffSessionDto>("/api/v1/auth/login", "POST", req);
  }

  /** Current staff session, or an ApiError with status 401 when unauthenticated. */
  public async getSession(): Promise<StaffSessionDto> {
    return this.request<StaffSessionDto>("/api/v1/auth/session", "GET");
  }

  /** Rotates the refresh cookie and returns the new session state. */
  public async refreshSession(): Promise<StaffSessionDto> {
    return this.request<StaffSessionDto>("/api/v1/auth/refresh", "POST");
  }

  /** Revokes this device's refresh session and clears the cookies. */
  public async logout(): Promise<void> {
    await this.request<{ success: boolean }>("/api/v1/auth/logout", "POST");
  }

  /** Revokes every session for the signed-in staff member. */
  public async revokeSessions(): Promise<void> {
    await this.request<{ success: boolean }>("/api/v1/auth/revoke", "POST");
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

  public async getOrderStatus(orderId: string): Promise<OrderStatusResponseDto> {
    return this.request<OrderStatusResponseDto>(
      `/api/v1/orders/${encodeURIComponent(orderId)}/status`,
      "GET",
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

  public async queueMenuSync(req: MenuSyncRequest): Promise<MenuSyncResponse> {
    return this.request<MenuSyncResponse>("/api/v1/menu/sync", "POST", req);
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

  // --- Mess Ledger Endpoints ---
  public async messTopup(req: MessTopUpRequest): Promise<MessLedgerResponse> {
    return this.request<MessLedgerResponse>("/api/v1/mess/topup", "POST", req);
  }

  public async messPay(req: MessPayRequest): Promise<MessLedgerResponse> {
    return this.request<MessLedgerResponse>("/api/v1/mess/pay", "POST", req);
  }

  public async messBalance(accountId: string): Promise<number> {
    const res = await this.request<MessBalanceResponse>(`/api/v1/mess/accounts/${accountId}/balance`, "GET");
    return res.balance_minor;
  }

  // --- Refund Endpoints ---
  public async recordRefund(req: RefundRequest): Promise<RefundResponse> {
    return this.request<RefundResponse>("/api/v1/refunds", "POST", req);
  }

  // --- Audit Listing Endpoint ---
  public async listAuditEvents(limit?: number): Promise<AuditEventDto[]> {
    const res = await this.request<AuditListResponse>("/api/v1/audit", "GET", undefined, { limit });
    return res.events;
  }


  // --- End of Day (EOD) Shift Endpoints ---
  public async openShift(req: OpenShiftRequest): Promise<OpenShiftResponse> {
    return this.request<OpenShiftResponse>("/api/v1/eod/open", "POST", req);
  }

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

  // --- Staff Endpoints ---
  public async createStaff(req: CreateStaffRequest): Promise<StaffResponseDto> {
    return this.request<StaffResponseDto>("/api/v1/staff", "POST", req);
  }

  public async listStaff(): Promise<ListStaffResponse> {
    return this.request<ListStaffResponse>("/api/v1/staff", "GET");
  }

  public async getStaff(staffId: string): Promise<StaffResponseDto> {
    return this.request<StaffResponseDto>(`/api/v1/staff/${encodeURIComponent(staffId)}`, "GET");
  }

  public async updateStaff(staffId: string, req: UpdateStaffRequest): Promise<StaffResponseDto> {
    return this.request<StaffResponseDto>(`/api/v1/staff/${encodeURIComponent(staffId)}`, "PATCH", req);
  }

  public async verifyStaffPin(staffId: string, req: PinVerifyRequest): Promise<PinVerifyResponse> {
    return this.request<PinVerifyResponse>(`/api/v1/staff/${encodeURIComponent(staffId)}/pin-verify`, "POST", req);
  }

  // --- Public Portal Endpoints ---
  public async getPublicTenants(): Promise<PublicTenantDto[]> {
    return this.request<PublicTenantDto[]>("/api/v1/public/tenants", "GET");
  }

  public async getPublicMenu(tenantId?: string | null): Promise<PublicMenuCatalogResponseDto> {
    const effectiveTenantId = tenantId ?? this.config.tenantId;
    if (!effectiveTenantId) {
      throw new ApiError("tenant_id is required to fetch public menu", 400, "INVALID_REQUEST");
    }
    return this.request<PublicMenuCatalogResponseDto>(
      "/api/v1/public/menu",
      "GET",
      undefined,
      { tenant_id: effectiveTenantId },
    );
  }

  public async createPublicOrder(req: CreatePublicOrderRequest): Promise<PublicOrderResponseDto> {
    return this.request<PublicOrderResponseDto>("/api/v1/public/orders", "POST", req);
  }

  public async getPublicOrderStatus(
    orderId: string,
    tenantId?: string | null,
  ): Promise<PublicOrderStatusResponseDto> {
    const effectiveTenantId = tenantId ?? this.config.tenantId;
    if (!effectiveTenantId) {
      throw new ApiError("tenant_id is required to fetch public order status", 400, "INVALID_REQUEST");
    }
    return this.request<PublicOrderStatusResponseDto>(
      `/api/v1/public/orders/${encodeURIComponent(orderId)}/status`,
      "GET",
      undefined,
      { tenant_id: effectiveTenantId },
    );
  }

  // --- Customer Auth Endpoints ---
  public async customerLogin(req: CustomerLoginRequest): Promise<CustomerLoginResponseDto> {
    const raw = await this.request<{
      expires_in?: number;
      customer: CustomerProfileDto;
    }>("/api/v1/customer-auth/login", "POST", req);

    return {
      expires_in: raw.expires_in,
      customer: raw.customer,
    };
  }

  /** Current customer session, or an ApiError with status 401 when unauthenticated. */
  public async customerSession(): Promise<CustomerSessionDto> {
    return this.request<CustomerSessionDto>("/api/v1/customer-auth/session", "GET");
  }

  /** Rotates the customer refresh cookie and returns the profile again. */
  public async customerRefresh(): Promise<CustomerLoginResponseDto> {
    return this.request<CustomerLoginResponseDto>("/api/v1/customer-auth/refresh", "POST");
  }

  /** Revokes this device's customer session and clears the cookies. */
  public async customerLogout(): Promise<void> {
    await this.request<{ success: boolean }>("/api/v1/customer-auth/logout", "POST");
  }

  public async customerRegister(req: CustomerRegisterRequest): Promise<CustomerProfileDto> {
    return this.request<CustomerProfileDto>("/api/v1/customer-auth/register", "POST", req);
  }
}
