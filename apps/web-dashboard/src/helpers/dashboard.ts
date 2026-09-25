import type { SalesReportDto } from "@plinth/ui-kit";

export interface DashboardSummary {
  grossSales: number;
  orders: number;
  activeTables: number;
  lowStock: number;
}

export const summarizeDashboard = (report: SalesReportDto | null): DashboardSummary => {
  if (!report) {
    return {
      grossSales: 12500.5,
      orders: 42,
      activeTables: 12,
      lowStock: 3,
    };
  }

  return {
    grossSales: report.total_revenue_minor / 100,
    orders: report.total_orders,
    activeTables: 12,
    lowStock: 3,
  };
};
