import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { VendorsPage } from "./VendorsPage.js";

// Mock window.matchMedia if needed
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
        <VendorsPage />
      </App>
    </PlinthThemeProvider>,
  );
}

describe("VendorsPage", () => {
  it("renders seeded vendors correctly", async () => {
    renderPage();
    expect(await screen.findByText("Vendor / Supplier Directory")).toBeDefined();
    expect(await screen.findByText("Fresh Farms Produce")).toBeDefined();
    expect(await screen.findByText("Quality Meats Ltd")).toBeDefined();
    expect(await screen.findByText("Oceanic Seafoods")).toBeDefined();
    expect(await screen.findByText("Sunrise Dairy")).toBeDefined();
  });

  it("filters vendors when searching", async () => {
    renderPage();
    const searchInput = await screen.findByPlaceholderText("Search by name/contact…");
    fireEvent.change(searchInput, { target: { value: "Fresh Farms" } });

    expect(await screen.findByText("Fresh Farms Produce")).toBeDefined();
    expect(screen.queryByText("Quality Meats Ltd")).toBeNull();
  });

  it("opens the Add Vendor modal and validates required fields", async () => {
    renderPage();

    const addButton = await screen.findByRole("button", { name: /Add Vendor/i });
    fireEvent.click(addButton);

    expect(await screen.findByRole("dialog", { name: /Add Vendor/i })).toBeDefined();

    const saveButton = await screen.findByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeDefined();
      expect(screen.getByText("Contact is required")).toBeDefined();
      expect(screen.getByText("Items supplied is required")).toBeDefined();
      expect(screen.getByText("Lead time is required")).toBeDefined();
    });
  });
});
