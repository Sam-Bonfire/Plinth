import { create } from "zustand";

export interface KdsTicket {
  id: string;
  orderId: string;
  station: string;
  status: "Pending" | "InPrep" | "Ready" | "Bumped" | "Cancelled";
  kotNumber: number;
  createdAt: string;
}

export interface KdsState {
  tickets: KdsTicket[];
  activeStation: string | null;
  loading: boolean;
}

export interface KdsActions {
  setTickets: (tickets: KdsTicket[]) => void;
  upsertTicket: (ticket: KdsTicket) => void;
  removeTicket: (id: string) => void;
  setStatus: (id: string, status: KdsTicket["status"]) => void;
  setActiveStation: (station: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export type KdsStore = KdsState & KdsActions;

const initialState: KdsState = {
  tickets: [],
  activeStation: null,
  loading: false,
};

const TERMINAL_STATUSES: KdsTicket["status"][] = ["Bumped", "Cancelled"];

export const useKdsStore = create<KdsStore>()((set) => ({
  ...initialState,
  setTickets: (tickets: KdsTicket[]): void => {
    set({ tickets });
  },
  upsertTicket: (ticket: KdsTicket): void => {
    set((state) => {
      const exists = state.tickets.some((t) => t.id === ticket.id);
      return {
        tickets: exists
          ? state.tickets.map((t) => (t.id === ticket.id ? ticket : t))
          : [...state.tickets, ticket],
      };
    });
  },
  removeTicket: (id: string): void => {
    set((state) => ({
      tickets: state.tickets.filter((t) => t.id !== id),
    }));
  },
  setStatus: (id: string, status: KdsTicket["status"]): void => {
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  },
  setActiveStation: (station: string | null): void => {
    set({ activeStation: station });
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectVisibleTickets(state: KdsStore): KdsTicket[] {
  const list =
    state.activeStation === null
      ? state.tickets
      : state.tickets.filter((t) => t.station === state.activeStation);
  return list.filter((t) => !TERMINAL_STATUSES.includes(t.status));
}

export function selectTicketCounts(state: KdsStore): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of state.tickets) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
}
