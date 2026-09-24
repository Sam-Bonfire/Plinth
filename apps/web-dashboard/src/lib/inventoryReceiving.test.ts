import { describe, expect, it } from "vitest";
import { receivePurchaseOrder } from "./inventoryReceiving.js";

const rows = [
  { key: "ING-01", name: "Tomato", current: 3 },
  { key: "ING-02", name: "Milk", current: 4 },
];

describe("receivePurchaseOrder", () => {
  it("adds quantities to matched stock case-insensitively", () => {
    const res = receivePurchaseOrder(rows, [
      { item: "tomato", qty: 10 },
      { item: "MILK", qty: 5 },
    ]);
    expect(res.received).toBe(2);
    expect(res.unmatched).toEqual([]);
    expect(res.updated.find((r) => r.name === "Tomato")?.current).toBe(13);
    expect(res.updated.find((r) => r.name === "Milk")?.current).toBe(9);
  });

  it("reports unmatched lines and skips non-positive qty", () => {
    const res = receivePurchaseOrder(rows, [
      { item: "Saffron", qty: 1 },
      { item: "Tomato", qty: 0 },
    ]);
    expect(res.received).toBe(0);
    expect(res.unmatched).toEqual(["Saffron"]);
    expect(res.updated.find((r) => r.name === "Tomato")?.current).toBe(3);
  });
});
