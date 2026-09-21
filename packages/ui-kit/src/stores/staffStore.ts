import { create } from "zustand";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  permissions: number;
  isActive: boolean;
}

export interface StaffState {
  members: StaffMember[];
  selectedId: string | null;
  loading: boolean;
}

export interface StaffActions {
  setMembers: (members: StaffMember[]) => void;
  upsertMember: (member: StaffMember) => void;
  removeMember: (id: string) => void;
  select: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setActive: (id: string, isActive: boolean) => void;
  reset: () => void;
}

export type StaffStore = StaffState & StaffActions;

const initialState: StaffState = {
  members: [],
  selectedId: null,
  loading: false,
};

export const useStaffStore = create<StaffStore>()((set) => ({
  ...initialState,
  setMembers: (members: StaffMember[]): void => {
    set((state) => ({
      members,
      selectedId: members.some((m) => m.id === state.selectedId) ? state.selectedId : null,
    }));
  },
  upsertMember: (member: StaffMember): void => {
    set((state) => {
      const exists = state.members.some((m) => m.id === member.id);
      return {
        members: exists
          ? state.members.map((m) => (m.id === member.id ? member : m))
          : [...state.members, member],
      };
    });
  },
  removeMember: (id: string): void => {
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },
  select: (id: string | null): void => {
    set({ selectedId: id });
  },
  setLoading: (loading: boolean): void => {
    set({ loading });
  },
  setActive: (id: string, isActive: boolean): void => {
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, isActive } : m)),
    }));
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectSelected(state: StaffStore): StaffMember | null {
  return state.members.find((m) => m.id === state.selectedId) ?? null;
}

export function selectActiveMembers(state: StaffStore): StaffMember[] {
  return state.members.filter((m) => m.isActive);
}

export function selectCan(state: StaffStore, id: string, permission: number): boolean {
  const member = state.members.find((m) => m.id === id);
  if (!member || !member.isActive) {
    return false;
  }
  return (member.permissions & permission) === permission;
}
