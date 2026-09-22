import { create } from "zustand";

export type ReportPeriod = "today" | "week" | "month";

export interface ReportsState {
  period: ReportPeriod;
  loading: boolean;
}

export interface ReportsActions {
  setPeriod: (period: ReportPeriod) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type ReportsStore = ReportsState & ReportsActions;

const initialState: ReportsState = {
  period: "today",
  loading: false,
};

const VALID_PERIODS: ReportPeriod[] = ["today", "week", "month"];

export const useReportsStore = create<ReportsStore>()((set) => ({
  ...initialState,
  setPeriod: (period: ReportPeriod): void => {
    if (!VALID_PERIODS.includes(period)) {
      return;
    }
    set({ period });
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectPeriodLabel(state: ReportsStore): string {
  switch (state.period) {
    case "today":
      return "Today";
    case "week":
      return "Last 7 days";
    case "month":
      return "Last 30 days";
  }
}
