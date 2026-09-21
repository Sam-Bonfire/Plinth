import { describe, it, expect, beforeEach } from "vitest";
import { useInventoryStore, selectBelowReorder, selectStockById } from "./inventoryStore.js";

describe("InventoryStore", () => {
  beforeEach(() => {
    useInventoryStore.getState().reset();
  });

  it("adjusts quantities and flags below-reorder stock", () => {
    useInventoryStore.getState().setItems([
      { id: "s-1", name: "Flour", unit: "kg", quantity: 10, reorderLevel: 5 },
      { id: "s-2", name: "Sugar", unit: "kg", quantity: 4, reorderLevel: 5 },
    ]);
    expect(selectBelowReorder(useInventoryStore.getState()).map((i) => i.id)).toEqual(["s-2"]);
    useInventoryStore.getState().adjustQuantity("s-1", -7);
    expect(selectBelowReorder(useInventoryStore.getState()).map((i) => i.id)).toEqual([
      "s-1",
      "s-2",
    ]);
    expect(selectStockById(useInventoryStore.getState(), "missing")).toBeNull();
  });

  it("updates reorder levels", () => {
    useInventoryStore.getState().setItems([
      { id: "s-1", name: "Flour", unit: "kg", quantity: 10, reorderLevel: 5 },
    ]);
    useInventoryStore.getState().setReorderLevel("s-1", 12);
    expect(selectBelowReorder(useInventoryStore.getState())).toHaveLength(1);
  });
});
