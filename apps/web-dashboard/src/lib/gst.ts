import type { GstRate } from "@plinth/ui-kit";

export interface GstInputRow {
  rate: GstRate;
  taxableAmount: number;
}

export interface GstSlabSummary {
  rate: GstRate;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface GstSummary {
  slabs: GstSlabSummary[];
  totalTax: number;
}

export function getGstPercent(rate: GstRate): number {
  switch (rate) {
    case "Exempt": return 0;
    case "FivePercent": return 5;
    case "TwelvePercent": return 12;
    case "EighteenPercent": return 18;
    case "TwentyEightPercent": return 28;
    default: return 0;
  }
}

export function summarizeGst(rows: GstInputRow[]): GstSummary {
  const slabMap = new Map<GstRate, GstSlabSummary>();

  for (const row of rows) {
    let slab = slabMap.get(row.rate);
    if (!slab) {
      slab = {
        rate: row.rate,
        ratePercent: getGstPercent(row.rate),
        taxableAmount: 0,
        taxAmount: 0,
      };
      slabMap.set(row.rate, slab);
    }
    slab.taxableAmount += row.taxableAmount;
    slab.taxAmount += row.taxableAmount * (slab.ratePercent / 100);
  }

  // Sort by rate percent ascending
  const slabs = Array.from(slabMap.values()).sort((a, b) => a.ratePercent - b.ratePercent);

  const totalTax = slabs.reduce((sum, slab) => sum + slab.taxAmount, 0);

  return {
    slabs,
    totalTax,
  };
}
