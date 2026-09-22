import * as tauriApiCore from '@tauri-apps/api/core';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTauriIpc, Order } from './useTauriIpc';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useTauriIpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isLoading false and error null', () => {
    const { result } = renderHook(() => useTauriIpc());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should call submitOrder with correct command and args', async () => {
    vi.mocked(tauriApiCore.invoke).mockResolvedValueOnce('order-123');

    const { result } = renderHook(() => useTauriIpc());

    const req = {
      tenant_id: 't1',
      location_id: 'l1',
      terminal_id: 'term1',
      channel: 'DineIn',
      created_by: 'staff1',
      table_id: null,
      seat_number: null,
      items: [],
    };

    let orderId: string | undefined;
    await act(async () => {
      orderId = await result.current.submitOrder(req);
    });

    expect(tauriApiCore.invoke).toHaveBeenCalledWith('submit_order', { req });
    expect(orderId).toBe('order-123');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle getActiveOrders', async () => {
    const mockOrders: Partial<Order>[] = [{ id: 'order1' }];
    vi.mocked(tauriApiCore.invoke).mockResolvedValueOnce(mockOrders);

    const { result } = renderHook(() => useTauriIpc());

    let orders: Order[] | undefined;
    await act(async () => {
      orders = await result.current.getActiveOrders('table1');
    });

    expect(tauriApiCore.invoke).toHaveBeenCalledWith('get_active_orders', { table_id: 'table1' });
    expect(orders).toEqual(mockOrders);
  });

  it('should handle error properly when invoke fails', async () => {
    const errorMessage = 'Something went wrong';
    vi.mocked(tauriApiCore.invoke).mockRejectedValueOnce(errorMessage);

    const { result } = renderHook(() => useTauriIpc());

    const req = {
      order_id: 'order1',
      target_status: 'Confirmed'
    };

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.advanceOrderStatus(req);
      } catch (err) {
        caughtError = err;
      }
    });

    expect(tauriApiCore.invoke).toHaveBeenCalledWith('advance_order_status', { req });
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe(errorMessage);
  });
});
