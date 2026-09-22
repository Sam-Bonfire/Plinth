import { create } from "zustand";

export interface ManagedRecipe {
  id: string;
  name: string;
  cost: number;
  margin: string;
  ingredients: string[];
}

export interface RecipeState {
  recipes: ManagedRecipe[];
}

export interface RecipeActions {
  setRecipes: (recipes: ManagedRecipe[]) => void;
  upsertRecipe: (recipe: ManagedRecipe) => void;
  removeRecipe: (id: string) => void;
  updateCost: (id: string, cost: number) => void;
  reset: () => void;
}

export type RecipeStore = RecipeState & RecipeActions;

const initialState: RecipeState = {
  recipes: [],
};

export const useRecipeStore = create<RecipeStore>()((set) => ({
  ...initialState,
  setRecipes: (recipes: ManagedRecipe[]): void => {
    set({ recipes });
  },
  upsertRecipe: (recipe: ManagedRecipe): void => {
    set((state) => {
      const exists = state.recipes.some((r) => r.id === recipe.id);
      return {
        recipes: exists
          ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [...state.recipes, recipe],
      };
    });
  },
  removeRecipe: (id: string): void => {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
    }));
  },
  updateCost: (id: string, cost: number): void => {
    if (cost < 0) {
      return;
    }
    set((state) => ({
      recipes: state.recipes.map((r) => (r.id === id ? { ...r, cost } : r)),
    }));
  },
  reset: (): void => {
    set({ ...initialState });
  },
}));

export function searchRecipes(state: RecipeStore, query: string): ManagedRecipe[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return state.recipes;
  }
  return state.recipes.filter(
    (r) => r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q)),
  );
}

export function selectAverageCost(state: RecipeStore): number {
  if (state.recipes.length === 0) {
    return 0;
  }
  return state.recipes.reduce((sum, r) => sum + r.cost, 0) / state.recipes.length;
}
