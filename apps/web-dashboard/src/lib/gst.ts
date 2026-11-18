import type { GstRate } from "@plinth/ui-kit";
import { fromMinor, gstPercent, summarizeGstSlabs, toMinor } from "./moneyBilling.js";

export interface GstInputRow {
  rate: GstRate;
  /** Taxable amount in rupees. */
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

/** @deprecated Prefer gstPercent from moneyBilling. Kept as a compatibility shim. */
export function getGstPercent(rate: GstRate): number {
  return gstPercent(rate);
}

/** Summarizes GST using minor-unit math, returning rupee values for callers. */
export function summarizeGst(rows: GstInputRow[]): GstSummary {
  const result = summarizeGstSlabs(
    rows.map((row) => ({ rate: row.rate, taxableMinor: toMinor(row.taxableAmount) })),
  );
  return {
    slabs: result.slabs.map((slab) => ({
      rate: slab.rate,
      ratePercent: slab.ratePercent,
      taxableAmount: fromMinor(slab.taxableMinor),
      taxAmount: fromMinor(slab.taxMinor),
    })),
    totalTax: fromMinor(result.totalTaxMinor),
  };
}

