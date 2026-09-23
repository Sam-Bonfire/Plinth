import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { subRecipeCost, type Recipe } from "../data/recipes.js";
import { RecipesPage } from "./RecipesPage.js";


// Note: Add global.window.matchMedia mock if required by antd components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

describe("subRecipeCost", () => {
  it("calculates cost without sub-recipes", () => {
    const recipe: Recipe = { key: "1", item: "Test", uses: "Ing1, Ing2", cost: 100, margin: "0%" };
    const allRecipes: Recipe[] = [];
    expect(subRecipeCost(recipe, allRecipes)).toBe(100);
  });

  it("calculates cost with a valid sub-recipe", () => {
    const recipe: Recipe = { key: "1", item: "Test", uses: "Ing1, Base", cost: 100, margin: "0%" };
    const allRecipes: Recipe[] = [
      { key: "2", item: "Base", uses: "Sub1", cost: 50, margin: "0%", isSubRecipe: true }
    ];
    expect(subRecipeCost(recipe, allRecipes)).toBe(150);
  });

  it("tolerates missing references", () => {
    const recipe: Recipe = { key: "1", item: "Test", uses: "Ing1, MissingBase", cost: 100, margin: "0%" };
    const allRecipes: Recipe[] = [
      { key: "2", item: "Base", uses: "Sub1", cost: 50, margin: "0%", isSubRecipe: true }
    ];
    expect(subRecipeCost(recipe, allRecipes)).toBe(100); // Only base cost should be included
  });

  it("ignores non-sub-recipe matches", () => {
    const recipe: Recipe = { key: "1", item: "Test", uses: "Ing1, NotSubBase", cost: 100, margin: "0%" };
    const allRecipes: Recipe[] = [
      { key: "2", item: "NotSubBase", uses: "Sub1", cost: 50, margin: "0%" } // isSubRecipe is undefined/false
    ];
    expect(subRecipeCost(recipe, allRecipes)).toBe(100);
  });

  it("handles empty or malformed uses strings gracefully", () => {
    const recipe: Recipe = { key: "1", item: "Test", uses: "  , ,,", cost: 100, margin: "0%" };
    const allRecipes: Recipe[] = [
      { key: "2", item: "Base", uses: "Sub1", cost: 50, margin: "0%", isSubRecipe: true }
    ];
    expect(subRecipeCost(recipe, allRecipes)).toBe(100);
  });
});

describe("RecipesPage", () => {
  it("renders main and base recipes with costs", async () => {
    render(<RecipesPage />);
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByText("Base Gravy")).toBeDefined();
  });

  it("filters by ingredient", async () => {
    render(<RecipesPage />);
    await screen.findByText("Butter Chicken");
    fireEvent.change(screen.getByPlaceholderText("Search recipes or ingredients…"), {
      target: { value: "naan" },
    });
    expect(await screen.findByText("Garlic Naan")).toBeDefined();
    expect(screen.queryByText("Butter Chicken")).toBeNull();
  });

  it("opens modal when clicking Add Recipe", async () => {
    render(<RecipesPage />);
    const addBtn = await screen.findByText("Add Recipe");
    fireEvent.click(addBtn);

    // the modal title should be "Add Recipe"
    const modals = await screen.findAllByText("Add Recipe");
    expect(modals.length).toBeGreaterThan(0);
  });
});
