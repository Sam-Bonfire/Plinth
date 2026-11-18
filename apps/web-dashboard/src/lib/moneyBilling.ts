import type { GstRate } from "@plinth/ui-kit";

export interface GstSlabRow {
  rate: GstRate;
  /** Taxable amount in integer minor units (paise). */
  taxableMinor: number;
}

export interface GstSlabSummary {
  rate: GstRate;
  ratePercent: number;
  taxableMinor: number;
  taxMinor: number;
}

export interface GstSummary {
  slabs: GstSlabSummary[];
  totalTaxMinor: number;
}

const GST_PERCENTS: Record<GstRate, number> = {
  Exempt: 0,
  FivePercent: 5,
  TwelvePercent: 12,
  EighteenPercent: 18,
  TwentyEightPercent: 28,
};

export function gstPercent(rate: GstRate): number {
  return GST_PERCENTS[rate] ?? 0;
}

/** Rounds a rupee amount to the nearest integer minor unit (paise). */
export function toMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/**
 * Formats an integer minor-unit amount as INR. Rounding is applied once, at the
 * minor-unit boundary, so every screen and receipt agrees.
 */
export function formatInrMinor(
  minor: number,
  options?: { maximumFractionDigits?: 0 | 2 },
): string {
  const fractionDigits = options?.maximumFractionDigits ?? 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.round(minor) / 100);
}

/** Formats a rupee amount as INR, normalizing through minor units first. */
export function formatInr(
  rupees: number,
  options?: { maximumFractionDigits?: 0 | 2 },
): string {
  return formatInrMinor(toMinor(rupees), options);
}

/**
 * Summarizes GST slabs from taxable amounts expressed in integer minor units.
 * Tax is rounded per slab on the minor-unit total so slab sums reconcile.
 */
export function summarizeGstSlabs(rows: readonly GstSlabRow[]): GstSummary {
  const byRate = new Map<GstRate, GstSlabSummary>();

  for (const row of rows) {
    let slab = byRate.get(row.rate);
    if (slab === undefined) {
      slab = {
        rate: row.rate,
        ratePercent: gstPercent(row.rate),
        taxableMinor: 0,
        taxMinor: 0,
      };
      byRate.set(row.rate, slab);
    }
    slab.taxableMinor += Math.round(row.taxableMinor);
  }

  const slabs = Array.from(byRate.values())
    .map((slab): GstSlabSummary => ({
      ...slab,
      taxMinor: Math.round((slab.taxableMinor * slab.ratePercent) / 100),
    }))
    .sort((a, b) => a.ratePercent - b.ratePercent);

  const totalTaxMinor = slabs.reduce((sum, slab) => sum + slab.taxMinor, 0);
  return { slabs, totalTaxMinor };
}
