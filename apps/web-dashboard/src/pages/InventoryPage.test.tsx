import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InventoryPage } from "./InventoryPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="mock-column-chart" />,
}));

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <InventoryPage />
    </PlinthThemeProvider>,
  );
}

describe("InventoryPage", () => {
  it("renders stock stats, levels and alerts", async () => {
    renderPage();
    expect(await screen.findByText("Total SKUs")).toBeDefined();
    expect(await screen.findByText("Chicken Breast")).toBeDefined();
    expect(await screen.findByText("Recipe Mapping")).toBeDefined();
    expect(await screen.findByText(/Tomato is low/)).toBeDefined();
  });

  it("filters stock by category", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    const filters = screen.getAllByRole("radiogroup");
    const inputs = within(filters[0] as HTMLElement).getAllByRole("radio");
    fireEvent.click(inputs[2] as HTMLElement);
    expect(await screen.findByText("Paneer")).toBeDefined();
    expect(screen.queryByText("Chicken Breast")).toBeNull();
  });

  it("adjusts an ingredient count", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    const adjusts = screen.getAllByRole("button", { name: "Adjust" });
    fireEvent.click(adjusts[0] as HTMLElement);
    expect(await screen.findByText("Adjust Chicken Breast")).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText(/set to 24 kg/)).toBeDefined();
  }, 15000);

  it("adds a new ingredient through the modal", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.change(await screen.findByPlaceholderText("Ingredient name"), { target: { value: "Cumin" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Cumin")).toBeDefined();
  }, 15000);
});
