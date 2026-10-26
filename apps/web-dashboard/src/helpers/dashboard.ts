import type { SalesReportDto } from "@plinth/ui-kit";

/**
 * Null means "not reported": the UI renders a dash instead of a made-up number.
 */
export interface DashboardSummary {
  grossSales: number | null;
  orders: number | null;
  activeTables: number | null;
  lowStock: number | null;
}

/**
 * Maps a sales report onto the dashboard tiles. Anything the report does not
 * carry stays unknown — the tiles never invent live-looking figures.
 */
export const summarizeDashboard = (report: SalesReportDto | null): DashboardSummary => {
  if (!report) {
    return { grossSales: null, orders: null, activeTables: null, lowStock: null };
  }

  return {
    grossSales: report.total_revenue_minor / 100,
    orders: report.total_orders,
    activeTables: null,
    lowStock: null,
  };
};
