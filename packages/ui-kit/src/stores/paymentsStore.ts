import { create } from "zustand";

export type PayMethodFilter = "all" | "UPI" | "Card" | "Cash";

export interface FinanceTotals {
  collected: number;
  upi: number;
  card: number;
  cash: number;
}

export interface PaymentsState {
  totals: FinanceTotals;
  methodFilter: PayMethodFilter;
  query: string;
  loading: boolean;
}

export interface PaymentsActions {
  setTotals: (totals: FinanceTotals) => void;
  setMethodFilter: (filter: PayMethodFilter) => void;
  setQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type PaymentsStore = PaymentsState & PaymentsActions;

const initialState: PaymentsState = {
  totals: { collected: 0, upi: 0, card: 0, cash: 0 },
  methodFilter: "all",
  query: "",
  loading: false,
};

export const usePaymentsStore = create<PaymentsStore>()((set) => ({
  ...initialState,
  setTotals: (totals: FinanceTotals): void => {
    set({ totals });
  },
  setMethodFilter: (filter: PayMethodFilter): void => {
    set({ methodFilter: filter });
  },
  setQuery: (query: string): void => {
    set({ query });
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectCashShare(state: PaymentsStore): number {
  if (state.totals.collected <= 0) {
    return 0;
  }
  return state.totals.cash / state.totals.collected;
}
