import type { SalesReportDto } from "@plinth/ui-kit";
import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "./dashboard.js";

describe("summarizeDashboard", () => {
  it("reports nothing as unknown instead of seed numbers", () => {
    expect(summarizeDashboard(null)).toEqual({
      grossSales: null,
      orders: null,
      activeTables: null,
      lowStock: null,
    });
  });

  it("computes summary from a valid SalesReportDto", () => {
    const report: SalesReportDto = {
      total_revenue_minor: 250000,
      total_orders: 15,
      hourly_volume: {},
      payment_distribution: {},
      tax_liability_minor: 5000,
    };

    expect(summarizeDashboard(report)).toEqual({
      grossSales: 2500,
      orders: 15,
      // The sales report carries no floor or stock state, so these stay unknown.
      activeTables: null,
      lowStock: null,
    });
  });
});
