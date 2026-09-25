import type { SalesReportDto } from "@plinth/ui-kit";
import { describe, expect, it } from "vitest";
import { summarizeDashboard } from "./dashboard.js";

describe("summarizeDashboard", () => {
  it("returns seed data when report is null", () => {
    const result = summarizeDashboard(null);
    expect(result).toEqual({
      grossSales: 12500.5,
      orders: 42,
      activeTables: 12,
      lowStock: 3,
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

    const result = summarizeDashboard(report);
    expect(result).toEqual({
      grossSales: 2500,
      orders: 15,
      activeTables: 12,
      lowStock: 3,
    });
  });
});
