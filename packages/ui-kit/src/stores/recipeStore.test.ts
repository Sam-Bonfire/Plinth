import { describe, it, expect, beforeEach } from "vitest";
import { useRecipeStore, searchRecipes, selectAverageCost } from "./recipeStore.js";

describe("RecipeStore", () => {
  beforeEach(() => {
    useRecipeStore.getState().reset();
  });

  it("upserts without duplicating", () => {
    useRecipeStore.getState().setRecipes([
      { id: "r-1", name: "Burger", cost: 100, margin: "60%", ingredients: ["Bun"] },
    ]);
    useRecipeStore.getState().upsertRecipe({ id: "r-1", name: "Burger", cost: 110, margin: "58%", ingredients: ["Bun"] });
    expect(useRecipeStore.getState().recipes).toHaveLength(1);
    expect(useRecipeStore.getState().recipes[0]?.cost).toBe(110);
  });

  it("rejects negative costs and removes", () => {
    useRecipeStore.getState().setRecipes([
      { id: "r-1", name: "Burger", cost: 100, margin: "60%", ingredients: [] },
    ]);
    useRecipeStore.getState().updateCost("r-1", -5);
    expect(useRecipeStore.getState().recipes[0]?.cost).toBe(100);
    useRecipeStore.getState().updateCost("r-1", 120);
    expect(useRecipeStore.getState().recipes[0]?.cost).toBe(120);
    useRecipeStore.getState().removeRecipe("r-1");
    expect(useRecipeStore.getState().recipes).toHaveLength(0);
  });

  it("searches names and ingredients and averages cost", () => {
    useRecipeStore.getState().setRecipes([
      { id: "r-1", name: "Burger", cost: 100, margin: "60%", ingredients: ["Bun", "Patty"] },
      { id: "r-2", name: "Fries", cost: 40, margin: "80%", ingredients: ["Potato"] },
    ]);
    expect(searchRecipes(useRecipeStore.getState(), "patty").map((r) => r.id)).toEqual(["r-1"]);
    expect(searchRecipes(useRecipeStore.getState(), "").map((r) => r.id)).toEqual(["r-1", "r-2"]);
    expect(selectAverageCost(useRecipeStore.getState())).toBe(70);
    useRecipeStore.getState().reset();
    expect(selectAverageCost(useRecipeStore.getState())).toBe(0);
  });
});
