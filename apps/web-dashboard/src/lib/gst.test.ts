import { describe, expect, it } from "vitest";
import { type GstInputRow, getGstPercent, summarizeGst } from "./gst.js";

describe("GST Summary Helper", () => {
  it("getGstPercent returns correct percentages", () => {
    expect(getGstPercent("Exempt")).toBe(0);
    expect(getGstPercent("FivePercent")).toBe(5);
    expect(getGstPercent("TwelvePercent")).toBe(12);
    expect(getGstPercent("EighteenPercent")).toBe(18);
    expect(getGstPercent("TwentyEightPercent")).toBe(28);
    // @ts-expect-error - Testing fallback for unknown rate
    expect(getGstPercent("Unknown")).toBe(0);
  });

  it("handles empty input", () => {
    const result = summarizeGst([]);
    expect(result.totalTax).toBe(0);
    expect(result.slabs).toHaveLength(0);
  });

  it("handles exempt rates (zero tax)", () => {
    const rows: GstInputRow[] = [
      { rate: "Exempt", taxableAmount: 1000 },
      { rate: "Exempt", taxableAmount: 500 },
    ];
    const result = summarizeGst(rows);
    expect(result.totalTax).toBe(0);
    expect(result.slabs).toHaveLength(1);
    expect(result.slabs[0]).toEqual({
      rate: "Exempt",
      ratePercent: 0,
      taxableAmount: 1500,
      taxAmount: 0,
    });
  });

  it("groups by slabs and computes totals correctly", () => {
    const rows: GstInputRow[] = [
      { rate: "FivePercent", taxableAmount: 1000 }, // Tax: 50
      { rate: "TwelvePercent", taxableAmount: 2000 }, // Tax: 240
      { rate: "FivePercent", taxableAmount: 500 }, // Tax: 25
      { rate: "EighteenPercent", taxableAmount: 1000 }, // Tax: 180
    ];

    const result = summarizeGst(rows);

    expect(result.totalTax).toBe(495); // 50 + 240 + 25 + 180 = 495
    expect(result.slabs).toHaveLength(3);

    // Sorted by rate ascending
    expect(result.slabs[0]).toEqual({
      rate: "FivePercent",
      ratePercent: 5,
      taxableAmount: 1500,
      taxAmount: 75,
    });
    expect(result.slabs[1]).toEqual({
      rate: "TwelvePercent",
      ratePercent: 12,
      taxableAmount: 2000,
      taxAmount: 240,
    });
    expect(result.slabs[2]).toEqual({
      rate: "EighteenPercent",
      ratePercent: 18,
      taxableAmount: 1000,
      taxAmount: 180,
    });
  });
});
