import { cartTotals, mockMenuItems } from "@plinth/ui-kit";
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cartStore.js";

const [first, second] = mockMenuItems;

describe("CartStore", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it("adds a line with modifier detail, in minor units", () => {
    if (!first) throw new Error("missing fixture item");
    const key = useCartStore.getState().addLine(first, ["Full", "Spicy"]);
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.key).toBe(key);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[0]?.detail).toBe("Full · Spicy");
    expect(lines[0]?.unitPriceMinor).toBe(Math.round(first.price * 100));
  });

  it("merges the same item and options into one line", () => {
    if (!first) throw new Error("missing fixture item");
    const key = useCartStore.getState().addLine(first, ["Full"]);
    const again = useCartStore.getState().addLine(first, ["Full"]);
    expect(again).toBe(key);
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]?.qty).toBe(2);
  });

  it("keeps different options on separate lines", () => {
    if (!first) throw new Error("missing fixture item");
    useCartStore.getState().addLine(first, ["Full"]);
    useCartStore.getState().addLine(first, ["Half"]);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("ignores null and sub-one quantities", () => {
    if (!first) throw new Error("missing fixture item");
    const key = useCartStore.getState().addLine(first, []);
    useCartStore.getState().changeQty(key, null);
    useCartStore.getState().changeQty(key, 0);
    useCartStore.getState().changeQty("missing", 5);
    expect(useCartStore.getState().lines[0]?.qty).toBe(1);
    useCartStore.getState().changeQty(key, 3);
    expect(useCartStore.getState().lines[0]?.qty).toBe(3);
  });

  it("removes lines and clears the cart", () => {
    if (!first || !second) throw new Error("missing fixture items");
    const keyA = useCartStore.getState().addLine(first, []);
    useCartStore.getState().addLine(second, []);
    useCartStore.getState().removeLine(keyA);
    expect(useCartStore.getState().lines).toHaveLength(1);
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("totals the lines it holds", () => {
    if (!first || !second) throw new Error("missing fixture items");
    useCartStore.getState().addLine({ ...first, price: 100, gstRate: 5 }, []);
    useCartStore.getState().addLine({ ...second, price: 200, gstRate: 12 }, []);
    const totals = cartTotals(useCartStore.getState().lines);
    expect(totals.subtotalMinor).toBe(30000);
    expect(totals.gstMinor).toBe(500 + 2400);
    expect(totals.count).toBe(2);
  });
});
