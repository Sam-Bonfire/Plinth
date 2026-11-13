import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { VendorsPage } from "./VendorsPage.js";

const h = vi.hoisted(() => ({
  vendorList: [
    {
      id: "V-1",
      tenant_id: "T-1",
      location_id: "L-1",
      name: "Fresh Farms Produce",
      contact: "contact@freshfarms.in",
      rate: "45.50",
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "V-2",
      tenant_id: "T-1",
      location_id: "L-1",
      name: "Quality Meats Ltd",
      contact: "orders@qualitymeats.in",
      rate: "120",
      active: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
}));

vi.mock("../providers/AuthProvider.js", () => ({
  useAuth: () => ({
    client: {
      listVendors: vi.fn().mockResolvedValue(h.vendorList),
      createVendor: h.createVendor.mockResolvedValue(h.vendorList[0]),
      updateVendor: h.updateVendor.mockResolvedValue(h.vendorList[0]),
    },
  }),
}));

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
  it("renders vendors from the API", async () => {
    renderPage();
    expect(await screen.findByText("Vendor / Supplier Directory")).toBeDefined();
    expect(await screen.findByText("Fresh Farms Produce")).toBeDefined();
    expect(await screen.findByText("Quality Meats Ltd")).toBeDefined();
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
      expect(screen.getByText("Rate is required")).toBeDefined();
    });
  });

  it("creates a vendor through the client", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Add Vendor/i }));
    fireEvent.change(await screen.findByPlaceholderText("Vendor name"), { target: { value: "Sunrise Dairy" } });
    fireEvent.change(await screen.findByPlaceholderText("Email or Phone"), { target: { value: "hello@sunrise.in" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: 30 } });
    fireEvent.click(await screen.findByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(h.createVendor).toHaveBeenCalledWith({
        name: "Sunrise Dairy",
        contact: "hello@sunrise.in",
        rate: "30",
      });
    });
    expect(await screen.findByText("Vendor added successfully")).toBeDefined();
  });
});
