import type { MenuItem } from "@plinth/ui-kit";
import { create } from "zustand";

export interface CartLine {
  key: string;
  itemId: string;
  name: string;
  detail: string;
  qty: number;
  rate: number;
  gstRate: number;
}

export interface CartRow extends CartLine {
  amount: number;
}

export interface CartState {
  lines: CartLine[];
}

export interface CartActions {
  addLine: (item: MenuItem, modifiers: string[]) => string;
  changeQty: (key: string, qty: number | null) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  reset: () => void;
}

export type CartStore = CartState & CartActions;

const initialState: CartState = {
  lines: [],
};

let lineSeq = 0;

export function nextCartKey(): string {
  lineSeq += 1;
  return `line-${lineSeq}`;
}

export const useCartStore = create<CartStore>()((set) => ({
  ...initialState,
  addLine: (item: MenuItem, modifiers: string[]): string => {
    const key = nextCartKey();
    set((state) => ({
      lines: [
        ...state.lines,
        {
          key,
          itemId: item.id,
          name: item.name,
          detail: modifiers.join(" · "),
          qty: 1,
          rate: item.price,
          gstRate: item.gstRate,
        },
      ],
    }));
    return key;
  },
  changeQty: (key: string, qty: number | null): void => {
    if (qty === null || qty < 1) {
      return;
    }
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, qty } : l)),
    }));
  },
  removeLine: (key: string): void => {
    set((state) => ({
      lines: state.lines.filter((l) => l.key !== key),
    }));
  },
  clear: (): void => {
    set({ lines: [] });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectSubtotal(state: CartStore): number {
  return state.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
}

export function selectGstTotal(state: CartStore): number {
  return state.lines.reduce((sum, l) => sum + (l.qty * l.rate * l.gstRate) / 100, 0);
}

export function selectItemCount(state: CartStore): number {
  return state.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function selectRows(state: CartStore): CartRow[] {
  return state.lines.map((l) => ({ ...l, amount: l.qty * l.rate }));
}
