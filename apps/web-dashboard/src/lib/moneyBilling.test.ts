import { describe, expect, it } from "vitest";
import { formatInr, formatInrMinor, fromMinor, gstPercent, summarizeGstSlabs, toMinor } from "./moneyBilling.js";

describe("money-billing formatting", () => {
  it("formats minor units with consistent rounding", () => {
    expect(formatInrMinor(54050)).toBe("₹540.50");
    expect(formatInrMinor(54050, { maximumFractionDigits: 0 })).toBe("₹541");
    expect(formatInr(540.505)).toBe("₹540.51");
    expect(fromMinor(toMinor(123.456))).toBe(123.46);
  });
});

describe("money-billing GST", () => {
  it("maps GST rates", () => {
    expect(gstPercent("Exempt")).toBe(0);
    expect(gstPercent("FivePercent")).toBe(5);
    expect(gstPercent("TwentyEightPercent")).toBe(28);
  });

  it("summarizes slabs in minor units and rounds per slab", () => {
    const result = summarizeGstSlabs([
      { rate: "FivePercent", taxableMinor: 100000 },
      { rate: "TwelvePercent", taxableMinor: 200000 },
      { rate: "FivePercent", taxableMinor: 50000 },
      { rate: "EighteenPercent", taxableMinor: 100000 },
    ]);

    expect(result.totalTaxMinor).toBe(49500);
    expect(result.slabs).toEqual([
      { rate: "FivePercent", ratePercent: 5, taxableMinor: 150000, taxMinor: 7500 },
      { rate: "TwelvePercent", ratePercent: 12, taxableMinor: 200000, taxMinor: 24000 },
      { rate: "EighteenPercent", ratePercent: 18, taxableMinor: 100000, taxMinor: 18000 },
    ]);
  });

  it("handles exempt and empty inputs", () => {
    expect(summarizeGstSlabs([])).toEqual({ slabs: [], totalTaxMinor: 0 });
    expect(summarizeGstSlabs([{ rate: "Exempt", taxableMinor: 150000 }])).toEqual({
      slabs: [{ rate: "Exempt", ratePercent: 0, taxableMinor: 150000, taxMinor: 0 }],
      totalTaxMinor: 0,
    });
  });
});
