import { useEffect } from "react";
import type { OrderStatus } from "@plinth/ui-kit";

export function tickOrders<T extends { status: OrderStatus }>(
  orders: T[],
  nextStatusMap: Partial<Record<OrderStatus, OrderStatus>>
): T[] {
  return orders.map((o) => {
    const next = nextStatusMap[o.status];
    return next !== undefined ? { ...o, status: next } : o;
  });
}

export function useTrackingTick<T extends { status: OrderStatus }>(
  apply: (step: (prev: T[], nextStatusMap: Partial<Record<OrderStatus, OrderStatus>>) => T[]) => void
): void {
  useEffect(() => {
    const timer = setInterval(() => {
      apply(tickOrders);
    }, 10000);
    return (): void => {
      clearInterval(timer);
    };
  }, [apply]);
}
