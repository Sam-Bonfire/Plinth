import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipesPage } from "./RecipesPage.js";

describe("RecipesPage", () => {
  it("renders recipes with costs", async () => {
    render(<RecipesPage />);
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByText("Garlic Naan")).toBeDefined();
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
});
