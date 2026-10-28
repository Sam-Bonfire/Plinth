import {
  addLine as addCartLine,
  cartLineKey,
  removeLine as removeCartLine,
  setLineQty,
  type CartLine,
  type MenuItem,
} from "@plinth/ui-kit";
import { create } from "zustand";

/** A cart line plus its extended amount, in major units for display. */
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

/** Menu prices are in rupees; the cart prices everything in minor units. */
const toLine = (item: MenuItem, modifiers: string[]): Omit<CartLine, "key" | "qty"> => ({
  itemId: item.id,
  name: item.name,
  detail: modifiers.join(" · "),
  unitPriceMinor: Math.round(item.price * 100),
  gstRatePercent: item.gstRate,
});

export const useCartStore = create<CartStore>()((set) => ({
  ...initialState,
  addLine: (item: MenuItem, modifiers: string[]): string => {
    const line = toLine(item, modifiers);
    set((state) => ({ lines: addCartLine(state.lines, line) }));
    return cartLineKey(line);
  },
  changeQty: (key: string, qty: number | null): void => {
    if (qty === null || qty < 1) {
      return;
    }
    set((state) => ({ lines: setLineQty(state.lines, key, qty) }));
  },
  removeLine: (key: string): void => {
    set((state) => ({ lines: removeCartLine(state.lines, key) }));
  },
  clear: (): void => {
    set({ lines: [] });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));
