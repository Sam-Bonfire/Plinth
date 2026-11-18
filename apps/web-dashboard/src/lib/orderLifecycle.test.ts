import { describe, expect, it } from "vitest";
import { advanceOrder, settleTender, voidOrder } from "./orderLifecycle.js";

describe("order lifecycle - advance", () => {
  it("advances exactly one step along the happy path", () => {
    expect(advanceOrder("Preparing")).toEqual({ ok: true, status: "Ready" });
    expect(advanceOrder("Ready")).toEqual({ ok: true, status: "Served" });
    expect(advanceOrder("Served")).toEqual({ ok: true, status: "Settled" });
  });

  it("refuses terminal and unknown states (no double-advance/skip)", () => {
    expect(advanceOrder("Settled")).toEqual({ ok: false, reason: "terminal" });
    expect(advanceOrder("Voided")).toEqual({ ok: false, reason: "terminal" });
    expect(advanceOrder("Refunded")).toEqual({ ok: false, reason: "terminal" });
    expect(advanceOrder("Cancelled")).toEqual({ ok: false, reason: "terminal" });
    expect(advanceOrder("Draft")).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("order lifecycle - void", () => {
  it("voids open orders", () => {
    expect(voidOrder("Draft")).toEqual({ ok: true, status: "Voided" });
    expect(voidOrder("Preparing")).toEqual({ ok: true, status: "Voided" });
    expect(voidOrder("Ready")).toEqual({ ok: true, status: "Voided" });
    expect(voidOrder("Served")).toEqual({ ok: true, status: "Voided" });
  });

  it("refuses void-after-settle and closed states", () => {
    expect(voidOrder("Settled")).toEqual({ ok: false, reason: "settled" });
    expect(voidOrder("Voided")).toEqual({ ok: false, reason: "already_voided" });
    expect(voidOrder("Refunded")).toEqual({ ok: false, reason: "refunded" });
    expect(voidOrder("Cancelled")).toEqual({ ok: false, reason: "cancelled" });
  });
});

describe("order lifecycle - tender", () => {
  it("settles exact and over tender with change in minor units", () => {
    expect(settleTender("Cash", 10000, 10000)).toEqual({ ok: true, changeMinor: 0 });
    expect(settleTender("Cash", 10000, 15000)).toEqual({ ok: true, changeMinor: 5000 });
  });

  it("rejects short or missing cash tender with shortfall", () => {
    expect(settleTender("Cash", 10000, 6000)).toEqual({ ok: false, reason: "short_tender", shortfallMinor: 4000 });
    expect(settleTender("Cash", 10000, null)).toEqual({ ok: false, reason: "missing_tender" });
    expect(settleTender("Cash", 10000, 0)).toEqual({ ok: false, reason: "missing_tender" });
  });

  it("accepts non-cash methods without tender amount", () => {
    expect(settleTender("UPI", 10000, null)).toEqual({ ok: true, changeMinor: 0 });
    expect(settleTender("Card", 10000, null)).toEqual({ ok: true, changeMinor: 0 });
  });
});
