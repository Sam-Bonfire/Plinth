import { create } from "zustand";

export interface MenuEntry {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  isAvailable: boolean;
}

export interface MenuCategoryEntry {
  id: string;
  name: string;
}

export interface MenuState {
  items: MenuEntry[];
  categories: MenuCategoryEntry[];
  activeCategoryId: string | null;
  query: string;
}

export interface MenuActions {
  setMenu: (items: MenuEntry[], categories: MenuCategoryEntry[]) => void;
  toggleAvailable: (id: string, isAvailable: boolean) => void;
  setActiveCategory: (id: string | null) => void;
  setQuery: (query: string) => void;
  reset: () => void;
}

export type MenuStore = MenuState & MenuActions;

const initialState: MenuState = {
  items: [],
  categories: [],
  activeCategoryId: null,
  query: "",
};

export const useMenuStore = create<MenuStore>()((set) => ({
  ...initialState,
  setMenu: (items: MenuEntry[], categories: MenuCategoryEntry[]): void => {
    set({ items, categories });
  },
  toggleAvailable: (id: string, isAvailable: boolean): void => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, isAvailable } : i)),
    }));
  },
  setActiveCategory: (id: string | null): void => {
    set({ activeCategoryId: id });
  },
  setQuery: (query: string): void => {
    set({ query });
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function selectVisibleItems(state: MenuStore): MenuEntry[] {
  const q = state.query.trim().toLowerCase();
  return state.items.filter((i) => {
    if (state.activeCategoryId !== null && i.categoryId !== state.activeCategoryId) {
      return false;
    }
    if (q !== "" && !i.name.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export function selectUnavailableCount(state: MenuStore): number {
  return state.items.filter((i) => !i.isAvailable).length;
}
