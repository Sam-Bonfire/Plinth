import { create } from "zustand";

export interface StockRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
}

export interface InventoryState {
  items: StockRow[];
  loading: boolean;
}

export interface InventoryActions {
  setItems: (items: StockRow[]) => void;
  adjustQuantity: (id: string, delta: number) => void;
  setReorderLevel: (id: string, reorderLevel: number) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type InventoryStore = InventoryState & InventoryActions;

const initialState: InventoryState = {
  items: [],
  loading: false,
};

export const useInventoryStore = create<InventoryStore>()((set) => ({
  ...initialState,
  setItems: (items: StockRow[]): void => {
    set({ items });
  },
  adjustQuantity: (id: string, delta: number): void => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i)),
    }));
  },
  setReorderLevel: (id: string, reorderLevel: number): void => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, reorderLevel } : i)),
    }));
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectBelowReorder(state: InventoryStore): StockRow[] {
  return state.items.filter((i) => i.quantity <= i.reorderLevel);
}

export function selectStockById(state: InventoryStore, id: string): StockRow | null {
  return state.items.find((i) => i.id === id) ?? null;
}
