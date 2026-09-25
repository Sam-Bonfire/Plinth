import { invoke } from '@tauri-apps/api/core';
import { useState, useCallback } from 'react';

export interface Money {
  amount: string;
  currency: string;
}

export interface ModifierSelection {
  group_id: string;
  option_id: string;
  name: string;
  price: Money;
  quantity: number;
}

export interface OrderLineItem {
  id: string;
  menu_item_id: string;
  name: string;
  base_price: Money;
  modifier_selections: ModifierSelection[];
  modifier_total: Money;
  unit_price: Money;
  quantity: number;
  fired_quantity: number;
  tax_rate: string;
  notes: string | null;
  seat_number: number | null;
}

export interface SubmitOrderRequest {
  tenant_id: string;
  location_id: string;
  terminal_id: string;
  channel: string;
  created_by: string;
  table_id: string | null;
  seat_number: number | null;
  items: OrderLineItem[];
}

export interface AdvanceOrderStatusRequest {
  order_id: string;
  target_status: string;
}

export interface VoidOrderRequest {
  order_id: string;
  reason: string;
  voided_by: string;
  is_supervisor: boolean;
}

export interface BumpTicketRequest {
  ticket_id: string;
  bumped_by: string | null;
}

export interface ToggleAvailabilityRequest {
  menu_item_id: string;
  is_available: boolean;
}

export interface AuthenticatePinRequest {
  pin: string;
}

export interface AuthenticatePinResponse {
  staff_id: string;
  name: string;
  role: string;
}

export interface RecordAuditEventRequest {
  action: string;
  target_type: string;
  target_id: string;
  payload_json: string | null;
  is_anomaly: boolean;
}

export interface SyncStatusResponse {
  pending: number;
  in_flight: number;
  dead_letter: number;
}

export interface Payment {
  id: string;
  method: string;
  amount: Money;
  status: string;
  reference: string | null;
  processed_by: string;
  created_at: string;
}

export interface Discount {
  discount_type: unknown;
  reason: string;
  authorized_by: string | null;
}

export interface OrderCharge {
  charge_type: string;
  amount: Money;
  label: string;
}

export interface TipAmount {
  tip_type: unknown;
  computed_amount: Money;
}

export interface Order {
  id: string;
  tenant_id: string;
  location_id: string;
  terminal_id: string;
  channel: string;
  status: string;
  created_by: string;
  table_id: string | null;
  seat_number: number | null;
  items: OrderLineItem[];
  payments: Payment[];
  discounts: Discount[];
  charges: OrderCharge[];
  tip: TipAmount | null;
  created_at: string;
  updated_at: string;
}

export interface TicketLineItem {
  line_item_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  modifiers: string[];
  special_instructions: string | null;
}

export interface DurationDto {
  secs: number;
  nanos: number;
}

export interface PreparationSla {
  warning_threshold: DurationDto;
  critical_threshold: DurationDto;
}

export interface KitchenTicket {
  id: string;
  order_id: string;
  tenant_id: string;
  location_id: string;
  station_id: string;
  status: string;
  priority: number;
  items: TicketLineItem[];
  sla: PreparationSla;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  bumped_at: string | null;
  bumped_by: string | null;
}

interface UseTauriIpcReturn {
  isLoading: boolean;
  error: Error | null;
  submitOrder: (req: SubmitOrderRequest) => Promise<string>;
  getActiveOrders: (table_id: string) => Promise<Order[]>;
  advanceOrderStatus: (req: AdvanceOrderStatusRequest) => Promise<void>;
  voidOrder: (req: VoidOrderRequest) => Promise<void>;
  getKdsTickets: (station: string) => Promise<KitchenTicket[]>;
  bumpTicket: (req: BumpTicketRequest) => Promise<void>;
  toggleMenuItemAvail: (req: ToggleAvailabilityRequest) => Promise<void>;
  authenticatePin: (req: AuthenticatePinRequest) => Promise<AuthenticatePinResponse>;
  recordAuditEvent: (req: RecordAuditEventRequest) => Promise<void>;
  getSyncStatus: () => Promise<SyncStatusResponse>;
  printReceipt: (payload: number[]) => Promise<string>;
  printQueueDepth: () => Promise<number>;
}

export function useTauriIpc(): UseTauriIpcReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const callInvoke = useCallback(
    async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
      setIsLoading(true);
      setError(null);
      try {
        return await invoke<T>(command, args);
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    submitOrder: (req: SubmitOrderRequest) => callInvoke<string>('submit_order', { req }),
    getActiveOrders: (table_id: string) => callInvoke<Order[]>('get_active_orders', { table_id }),
    advanceOrderStatus: (req: AdvanceOrderStatusRequest) => callInvoke<void>('advance_order_status', { req }),
    voidOrder: (req: VoidOrderRequest) => callInvoke<void>('void_order', { req }),
    getKdsTickets: (station: string) => callInvoke<KitchenTicket[]>('get_kds_tickets', { station }),
    bumpTicket: (req: BumpTicketRequest) => callInvoke<void>('bump_ticket', { req }),
    toggleMenuItemAvail: (req: ToggleAvailabilityRequest) => callInvoke<void>('toggle_menu_item_avail', { req }),
    authenticatePin: (req: AuthenticatePinRequest) => callInvoke<AuthenticatePinResponse>('authenticate_pin', { req }),
    recordAuditEvent: (req: RecordAuditEventRequest) => callInvoke<void>('record_audit_event', { req }),
    getSyncStatus: () => callInvoke<SyncStatusResponse>('get_sync_status'),
    printReceipt: (payload: number[]) => callInvoke<string>('print_receipt', { payload }),
    printQueueDepth: () => callInvoke<number>('print_queue_depth'),
  };
}
