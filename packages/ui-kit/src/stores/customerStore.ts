import { create } from "zustand";

export type CustomerTier = "Regular" | "Silver" | "Gold";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  tier: CustomerTier;
  visits: number;
  totalSpend: number;
  isActive: boolean;
}

export interface CustomerState {
  customers: Customer[];
  selectedId: string | null;
}

export interface CustomerActions {
  setCustomers: (customers: Customer[]) => void;
  upsertCustomer: (customer: Customer) => void;
  removeCustomer: (id: string) => void;
  select: (id: string | null) => void;
  setTier: (id: string, tier: CustomerTier) => void;
  recordVisit: (id: string, spend: number) => void;
  reset: () => void;
}

export type CustomerStore = CustomerState & CustomerActions;

const initialState: CustomerState = {
  customers: [],
  selectedId: null,
};

export const useCustomerStore = create<CustomerStore>()((set) => ({
  ...initialState,
  setCustomers: (customers: Customer[]): void => {
    set((state) => ({
      customers,
      selectedId: customers.some((c) => c.id === state.selectedId) ? state.selectedId : null,
    }));
  },
  upsertCustomer: (customer: Customer): void => {
    set((state) => {
      const exists = state.customers.some((c) => c.id === customer.id);
      return {
        customers: exists
          ? state.customers.map((c) => (c.id === customer.id ? customer : c))
          : [...state.customers, customer],
      };
    });
  },
  removeCustomer: (id: string): void => {
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },
  select: (id: string | null): void => {
    set({ selectedId: id });
  },
  setTier: (id: string, tier: CustomerTier): void => {
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? { ...c, tier } : c)),
    }));
  },
  recordVisit: (id: string, spend: number): void => {
    if (spend < 0) {
      return;
    }
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, visits: c.visits + 1, totalSpend: c.totalSpend + spend } : c,
      ),
    }));
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectSelectedCustomer(state: CustomerStore): Customer | null {
  return state.customers.find((c) => c.id === state.selectedId) ?? null;
}

export function selectByTier(state: CustomerStore, tier: CustomerTier): Customer[] {
  return state.customers.filter((c) => c.tier === tier);
}

export function selectTopSpenders(state: CustomerStore, limit: number): Customer[] {
  return [...state.customers].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, limit);
}

export function searchCustomers(state: CustomerStore, query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return state.customers;
  }
  return state.customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/[\s-]/g, "").includes(q.replace(/[\s-]/g, "")),
  );
}
