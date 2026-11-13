import "@testing-library/jest-dom/vitest";
import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { RecipesPage } from "./RecipesPage.js";

const h = vi.hoisted(() => ({
  recipes: [
    {
      id: "R-1",
      menu_item_id: "M-1",
      preparation_notes: null,
      ingredients: [
        { stock_item_id: "S-1", quantity: { value: "2", unit: "kg" }, wastage_percent: "0" },
        { stock_item_id: "S-2", quantity: { value: "1", unit: "L" }, wastage_percent: "10" },
      ],
    },
  ],
  stock: [
    {
      id: "S-1",
      name: "Chicken",
      unit: "kg",
      current_quantity: "10",
      par_level: "5",
      reorder_level: "2",
      cost_per_unit: { amount: "100", currency: "INR" },
      is_active: true,
      is_below_reorder: false,
    },
    {
      id: "S-2",
      name: "Milk",
      unit: "L",
      current_quantity: "4",
      par_level: "12",
      reorder_level: "3",
      cost_per_unit: { amount: "60", currency: "INR" },
      is_active: true,
      is_below_reorder: false,
    },
  ],
  catalog: {
    categories: [
      {
        id: "C-1",
        name: "Mains",
        display_order: 0,
        is_active: true,
        items: [
          {
            id: "M-1",
            primary_category_id: "C-1",
            name: "Butter Chicken",
            description: null,
            price_minor: 45000,
            tax_rate: "GST_5",
            is_veg: false,
            is_available: true,
            sku: null,
            kitchen_station: "K-1",
          },
        ],
      },
    ],
  },
}));

vi.mock("../providers/AuthProvider.js", () => ({
  useAuth: () => ({
    client: {
      listRecipes: vi.fn().mockResolvedValue(h.recipes),
      getInventory: vi.fn().mockResolvedValue(h.stock),
      getMenuCatalog: vi.fn().mockResolvedValue(h.catalog),
    },
  }),
}));

// Note: Add global.window.matchMedia mock if required by antd components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <App>
        <RecipesPage />
      </App>
    </PlinthThemeProvider>,
  );
}

describe("RecipesPage", () => {
  it("renders recipes with computed food cost and margin from the API", async () => {
    renderPage();
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByText("Chicken, Milk")).toBeDefined();
    // 2 x ₹100 + 1 x ₹60 x 1.1 wastage = ₹266
    expect((await screen.findAllByText("₹266")).length).toBeGreaterThan(0);
    // (450 - 266) / 450 = 41% margin
    expect(await screen.findByText("41%")).toBeDefined();
  });

  it("shows the recipe count and average food cost", async () => {
    renderPage();
    expect((await screen.findAllByText("Recipes")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Avg Food Cost")).toBeDefined();
    // avg of a single recipe = its cost
    expect((await screen.findAllByText("₹266")).length).toBeGreaterThan(0);
  });

  it("filters by ingredient", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    fireEvent.change(screen.getByPlaceholderText("Search recipes or ingredients…"), {
      target: { value: "milk" },
    });
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("Search recipes or ingredients…"), {
      target: { value: "naan" },
    });
    expect(await screen.findByText("No recipes match.")).toBeDefined();
  });
});
