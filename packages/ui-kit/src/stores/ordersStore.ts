import { create } from "zustand";

export interface LiveOrder {
  id: string;
  status: string;
  channel: string;
  tableId: string | null;
  total: number;
  itemCount: number;
  updatedAt: string;
}

export interface OrdersState {
  orders: LiveOrder[];
  loading: boolean;
}

export interface OrdersActions {
  setOrders: (orders: LiveOrder[]) => void;
  upsertOrder: (order: LiveOrder) => void;
  removeOrder: (id: string) => void;
  setStatus: (id: string, status: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type OrdersStore = OrdersState & OrdersActions;

const initialState: OrdersState = {
  orders: [],
  loading: false,
};

const CLOSED_STATUSES = new Set(["Settled", "Voided", "Refunded", "Cancelled"]);

export const useOrdersStore = create<OrdersStore>()((set) => ({
  ...initialState,
  setOrders: (orders: LiveOrder[]): void => {
    set({ orders });
  },
  upsertOrder: (order: LiveOrder): void => {
    set((state) => {
      const exists = state.orders.some((o) => o.id === order.id);
      return {
        orders: exists
          ? state.orders.map((o) => (o.id === order.id ? order : o))
          : [...state.orders, order],
      };
    });
  },
  removeOrder: (id: string): void => {
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== id),
    }));
  },
  setStatus: (id: string, status: string): void => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    }));
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectActiveOrders(state: OrdersStore): LiveOrder[] {
  return state.orders.filter((o) => !CLOSED_STATUSES.has(o.status));
}

export function selectOrdersByStatus(state: OrdersStore, status: string): LiveOrder[] {
  return state.orders.filter((o) => o.status === status);
}

export function selectOpenRevenue(state: OrdersStore): number {
  return selectActiveOrders(state).reduce((sum, o) => sum + o.total, 0);
}
