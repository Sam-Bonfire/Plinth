import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { InventoryPage } from "./InventoryPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="mock-column-chart" />,
  BarChart: () => <div data-testid="mock-barchart" />
}));
// Also mock window.matchMedia if needed
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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
        <InventoryPage />
      </App>
    </PlinthThemeProvider>,
  );
}

describe("InventoryPage", () => {
  it("receives a purchase order into stock levels", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    fireEvent.click(screen.getByRole("button", { name: "New PO" }));
    fireEvent.change(await screen.findByPlaceholderText("Supplier name"), { target: { value: "Fresh Farms" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Line" }));
    const qtys = screen.getAllByRole("spinbutton");
    fireEvent.change(qtys[qtys.length - 2] as HTMLElement, { target: { value: 10 } });
    fireEvent.change(qtys[qtys.length - 1] as HTMLElement, { target: { value: 40 } });
    const submits = screen.getAllByRole("button", { name: "Submit PO" });
    fireEvent.click(submits[submits.length - 1] as HTMLElement);
    expect(await screen.findByText(/received: 1 lines into stock/)).toBeDefined();
  }, 60000);
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
    // wait for success message text
    expect(await screen.findByText(/set to 24 kg/)).toBeDefined();
  }, 60000);

  it("adds a new ingredient through the modal", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.change(await screen.findByPlaceholderText("Ingredient name"), { target: { value: "Cumin" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Cumin")).toBeDefined();
  }, 60000);
});
