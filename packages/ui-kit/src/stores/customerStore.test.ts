import { describe, it, expect, beforeEach } from "vitest";
import { useCustomerStore, selectByTier, selectTopSpenders, searchCustomers } from "./customerStore.js";
import type { Customer } from "./customerStore.js";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c-1",
    name: "Asha Rao",
    phone: "+919820012345",
    tier: "Regular",
    visits: 0,
    totalSpend: 0,
    isActive: true,
    ...overrides,
  };
}

describe("CustomerStore", () => {
  beforeEach(() => {
    useCustomerStore.getState().reset();
  });

  it("records visits monotonically and rejects negative spend", () => {
    useCustomerStore.getState().setCustomers([customer()]);
    useCustomerStore.getState().recordVisit("c-1", 500);
    useCustomerStore.getState().recordVisit("c-1", -50);
    const c = useCustomerStore.getState().customers[0];
    expect(c?.visits).toBe(1);
    expect(c?.totalSpend).toBe(500);
  });

  it("filters by tier and ranks top spenders", () => {
    useCustomerStore.getState().setCustomers([
      customer(),
      customer({ id: "c-2", name: "Raj", tier: "Gold", totalSpend: 20000 }),
      customer({ id: "c-3", name: "Mina", tier: "Gold", totalSpend: 5000 }),
    ]);
    expect(selectByTier(useCustomerStore.getState(), "Gold")).toHaveLength(2);
    expect(selectTopSpenders(useCustomerStore.getState(), 1).map((c) => c.id)).toEqual(["c-2"]);
    useCustomerStore.getState().setTier("c-1", "Silver");
    expect(selectByTier(useCustomerStore.getState(), "Silver").map((c) => c.id)).toEqual(["c-1"]);
  });

  it("searches by name and phone", () => {
    useCustomerStore.getState().setCustomers([customer(), customer({ id: "c-2", name: "Raj", phone: "9811111111" })]);
    expect(searchCustomers(useCustomerStore.getState(), "asha")).toHaveLength(1);
    expect(searchCustomers(useCustomerStore.getState(), "98111")).toHaveLength(1);
    expect(searchCustomers(useCustomerStore.getState(), "")).toHaveLength(2);
  });

  it("removes and clears selection", () => {
    useCustomerStore.getState().setCustomers([customer()]);
    useCustomerStore.getState().select("c-1");
    useCustomerStore.getState().removeCustomer("c-1");
    expect(useCustomerStore.getState().customers).toHaveLength(0);
    expect(useCustomerStore.getState().selectedId).toBeNull();
  });
});
