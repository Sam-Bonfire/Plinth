import type { MenuItem } from '@plinth/ui-kit';
import { create } from 'zustand';

export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  modifiers: string[];
  qty: number;
  unitPrice: number;
}

export type AddToCartResult =
  | { ok: true; key?: string }
  | { ok: false; reason: string };

export interface ParkedOrder {
  id: string;
  customerLabel: string;
  timestamp: string;
  lines: CartLine[];
}

interface PosCartState {
  lines: CartLine[];
  parkedOrders: ParkedOrder[];
  tableId: string | null;
  setTable: (tableId: string | null) => void;
  addToCart: (item: MenuItem, selections: Record<string, string>) => AddToCartResult;
  changeQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  parkOrder: (customerLabel: string) => void;
  resumeOrder: (id: string) => void;
  voidOrder: (id: string) => void;
}

export const usePosCartStore = create<PosCartState>((set) => ({
  lines: [],
  parkedOrders: [],
  tableId: null,

  setTable: (tableId) => {
    set({ tableId });
  },

  addToCart: (item, selections) => {
    if (!item.isAvailable) {
      return { ok: false, reason: 'Item is unavailable' };
    }

    const modifiers: string[] = [];
    let unitPrice = item.price;

    for (const group of item.modifierGroups) {
      const selectedOptionName = selections[group.name];
      if (!selectedOptionName) {
        return { ok: false, reason: `Missing required modifier: ${group.name}` };
      }

      const option = group.options.find((o: { name: string; price?: number }) => o.name === selectedOptionName);
      if (option) {
        modifiers.push(option.name);
        if (option.price !== undefined) {
          unitPrice += option.price;
        }
      } else {
        // Technically this shouldn't happen if selections are valid, but good for completeness
        return { ok: false, reason: `Invalid modifier option for ${group.name}` };
      }
    }

    const key = [item.id, ...modifiers].join('-');

    set((state) => {
      const existingLineIndex = state.lines.findIndex((line) => line.key === key);

      if (existingLineIndex !== -1) {
        const newLines = [...state.lines];
        const existingLine = newLines[existingLineIndex];
        if (existingLine) {
          newLines[existingLineIndex] = {
            ...existingLine,
            qty: existingLine.qty + 1
          };
        }
        return { lines: newLines };
      }

      return {
        lines: [
          ...state.lines,
          {
            key,
            menuItemId: item.id,
            name: item.name,
            modifiers,
            qty: 1,
            unitPrice
          }
        ]
      };
    });

    return { ok: true, key };
  },

  changeQty: (key, qty) => {
    if (qty < 1) return;

    set((state) => ({
      lines: state.lines.map((line) =>
        line.key === key ? { ...line, qty } : line
      )
    }));
  },

  removeLine: (key) => {
    set((state) => ({
      lines: state.lines.filter((line) => line.key !== key)
    }));
  },

  clear: () => {
    set({ lines: [], tableId: null });
  },

  parkOrder: (customerLabel) => {
    set((state) => {
      if (state.lines.length === 0) return state;

      const newParkedOrder: ParkedOrder = {
        id: crypto.randomUUID(),
        customerLabel,
        timestamp: new Date().toISOString(),
        lines: [...state.lines]
      };

      return {
        lines: [],
        parkedOrders: [...state.parkedOrders, newParkedOrder]
      };
    });
  },

  resumeOrder: (id) => {
    set((state) => {
      const order = state.parkedOrders.find((o) => o.id === id);
      if (!order) return state;

      return {
        lines: [...order.lines],
        parkedOrders: state.parkedOrders.filter((o) => o.id !== id)
      };
    });
  },

  voidOrder: (id) => {
    set((state) => ({
      parkedOrders: state.parkedOrders.filter((o) => o.id !== id)
    }));
  }
}));

export const selectSubtotal = (state: PosCartState): number => {
  return state.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
};

export const selectItemCount = (state: PosCartState): number => {
  return state.lines.reduce((sum, line) => sum + line.qty, 0);
};
