import { describe, expect, it } from "vitest";
import { addLine, cartLineKey, cartTotals, removeLine, setLineQty, type CartLine, type CartLineInput } from "./cart.js";

const paneer: CartLineInput = {
  itemId: "MI-002",
  name: "Paneer Tikka",
  detail: "Spicy",
  unitPriceMinor: 28000,
  gstRatePercent: 5,
};

describe("cart lines", () => {
  it("merges a re-added item into one line", () => {
    const once = addLine([], paneer);
    const twice = addLine(once, paneer);
    expect(twice).toHaveLength(1);
    expect(twice[0]?.qty).toBe(2);
    expect(twice[0]?.key).toBe(cartLineKey(paneer));
  });

  it("keeps different options or prices on separate lines", () => {
    const lines = addLine(addLine([], paneer), { ...paneer, detail: "Mild" });
    const repriced = addLine(lines, { ...paneer, unitPriceMinor: 30000 });
    expect(repriced).toHaveLength(3);
    expect(new Set(repriced.map((l: CartLine): string => l.key)).size).toBe(3);
  });

  it("is idempotent for repeated adds of the same item", () => {
    let lines: CartLine[] = [];
    for (let i = 0; i < 5; i += 1) lines = addLine(lines, paneer);
    expect(lines).toHaveLength(1);
    expect(cartTotals(lines).subtotalMinor).toBe(5 * paneer.unitPriceMinor);
  });

  it("removes a line when quantity drops below one", () => {
    const lines = addLine([], paneer);
    const key = cartLineKey(paneer);
    expect(setLineQty(lines, key, 0)).toHaveLength(0);
    expect(setLineQty(lines, key, -2)).toHaveLength(0);
    expect(setLineQty(lines, "missing", 3)).toHaveLength(1);
    expect(setLineQty(lines, key, 3)[0]?.qty).toBe(3);
    expect(removeLine(lines, key)).toHaveLength(0);
  });
});

describe("cart totals", () => {
  it("sums subtotal, per-line GST and unit count", () => {
    const lines = addLine(addLine([], paneer), {
      itemId: "MI-005",
      name: "Mango Lassi",
      detail: "",
      unitPriceMinor: 11000,
      gstRatePercent: 12,
    });
    const withQty = setLineQty(lines, cartLineKey(paneer), 2);
    const totals = cartTotals(withQty);
    expect(totals.subtotalMinor).toBe(2 * 28000 + 11000);
    expect(totals.gstMinor).toBe(2 * 1400 + 1320);
    expect(totals.count).toBe(3);
  });

  it("rounds GST per line to whole minor units", () => {
    const odd = addLine([], {
      itemId: "MI-009",
      name: "Odd price",
      detail: "",
      unitPriceMinor: 3333,
      gstRatePercent: 18,
    });
    expect(cartTotals(odd).gstMinor).toBe(600);
  });

  it("treats an empty cart as zero", () => {
    expect(cartTotals([])).toEqual({ subtotalMinor: 0, gstMinor: 0, count: 0 });
  });
});
