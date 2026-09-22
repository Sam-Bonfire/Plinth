import { create } from "zustand";

export interface ShiftSummary {
  shiftId: string;
  openedAt: string;
  openingFloat: number;
  expectedCash: number;
  countedCash: number | null;
}

export interface EodState {
  shift: ShiftSummary | null;
  closedAt: string | null;
  loading: boolean;
}

export interface EodActions {
  openShift: (shift: ShiftSummary) => void;
  recordCount: (countedCash: number) => void;
  closeShift: (closedAt: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type EodStore = EodState & EodActions;

const initialState: EodState = {
  shift: null,
  closedAt: null,
  loading: false,
};

export const useEodStore = create<EodStore>()((set) => ({
  ...initialState,
  openShift: (shift: ShiftSummary): void => {
    set({ shift, closedAt: null });
  },
  recordCount: (countedCash: number): void => {
    set((state) => ({
      shift: state.shift ? { ...state.shift, countedCash } : state.shift,
    }));
  },
  closeShift: (closedAt: string): void => {
    set({ closedAt });
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectVariance(state: EodStore): number | null {
  if (!state.shift || state.shift.countedCash === null) {
    return null;
  }
  return state.shift.countedCash - state.shift.expectedCash;
}

export function selectIsClosed(state: EodStore): boolean {
  return state.closedAt !== null;
}
