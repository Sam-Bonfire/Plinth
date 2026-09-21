import { mockMenuItems } from "@plinth/ui-kit";
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore, selectSubtotal, selectGstTotal, selectItemCount, selectRows } from "./cartStore.js";

describe("CartStore", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it("adds lines with modifier detail and sequential keys", () => {
    const item = mockMenuItems[0];
    if (!item) throw new Error("missing fixture item");
    const key = useCartStore.getState().addLine(item, ["Full", "Spicy"]);
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.key).toBe(key);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[0]?.detail).toBe("Full · Spicy");
  });

  it("ignores null and sub-one quantities", () => {
    const item = mockMenuItems[0];
    if (!item) throw new Error("missing fixture item");
    const key = useCartStore.getState().addLine(item, []);
    useCartStore.getState().changeQty(key, null);
    useCartStore.getState().changeQty(key, 0);
    useCartStore.getState().changeQty("missing", 5);
    expect(useCartStore.getState().lines[0]?.qty).toBe(1);
    useCartStore.getState().changeQty(key, 3);
    expect(useCartStore.getState().lines[0]?.qty).toBe(3);
  });

  it("removes lines and clears the cart", () => {
    const [a, b] = mockMenuItems;
    if (!a || !b) throw new Error("missing fixture items");
    const keyA = useCartStore.getState().addLine(a, []);
    useCartStore.getState().addLine(b, []);
    useCartStore.getState().removeLine(keyA);
    expect(useCartStore.getState().lines).toHaveLength(1);
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("computes subtotal, gst, count, and row amounts", () => {
    const [a, b] = mockMenuItems;
    if (!a || !b) throw new Error("missing fixture items");
    useCartStore.getState().addLine({ ...a, price: 100, gstRate: 5 }, []);
    useCartStore.getState().addLine({ ...b, price: 200, gstRate: 12 }, []);
    const state = useCartStore.getState();
    expect(selectSubtotal(state)).toBe(300);
    expect(selectGstTotal(state)).toBe(5 + 24);
    expect(selectItemCount(state)).toBe(2);
    expect(selectRows(state).map((r) => r.amount)).toEqual([100, 200]);
  });
});
