import { describe, it, expect, beforeEach } from "vitest";
import { useOrdersStore, selectActiveOrders, selectOrdersByStatus, selectOpenRevenue } from "./ordersStore.js";
import type { LiveOrder } from "./ordersStore.js";

function order(overrides: Partial<LiveOrder> = {}): LiveOrder {
  return {
    id: "o-1",
    status: "Confirmed",
    channel: "DineIn",
    tableId: "T-4",
    total: 500,
    itemCount: 2,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("OrdersStore", () => {
  beforeEach(() => {
    useOrdersStore.getState().reset();
  });

  it("upserts and separates active from closed", () => {
    useOrdersStore.getState().setOrders([
      order(),
      order({ id: "o-2", status: "Settled", total: 300 }),
      order({ id: "o-3", status: "Voided", total: 100 }),
    ]);
    expect(selectActiveOrders(useOrdersStore.getState())).toHaveLength(1);
    expect(selectOpenRevenue(useOrdersStore.getState())).toBe(500);
    useOrdersStore.getState().setStatus("o-1", "Served");
    expect(selectOrdersByStatus(useOrdersStore.getState(), "Served")).toHaveLength(1);
    expect(selectOpenRevenue(useOrdersStore.getState())).toBe(500);
  });

  it("removes orders", () => {
    useOrdersStore.getState().setOrders([order()]);
    useOrdersStore.getState().removeOrder("o-1");
    expect(useOrdersStore.getState().orders).toHaveLength(0);
  });
});
