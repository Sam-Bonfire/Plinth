import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { InventoryPage } from "./InventoryPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="mock-column-chart" />,
  BarChart: () => <div data-testid="mock-barchart" />
}));

const h = vi.hoisted(() => ({
  stock: [
    { id: "S-1", name: "Chicken Breast", unit: "kg", current_quantity: "24", par_level: "15", reorder_level: "8", cost_per_unit: { amount: "40", currency: "INR" }, is_active: true, is_below_reorder: false },
    { id: "S-2", name: "Paneer", unit: "kg", current_quantity: "18", par_level: "10", reorder_level: "5", cost_per_unit: { amount: "30", currency: "INR" }, is_active: true, is_below_reorder: false },
    { id: "S-3", name: "Tomato", unit: "kg", current_quantity: "3", par_level: "10", reorder_level: "4", cost_per_unit: { amount: "20", currency: "INR" }, is_active: true, is_below_reorder: true },
  ],
  vendors: [
    { id: "V-1", tenant_id: "T-1", location_id: "L-1", name: "Fresh Farms", contact: "contact@freshfarms.in", rate: "45.50", active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  ],
  purchaseOrders: [
    {
      id: "PO-1",
      tenant_id: "T-1",
      location_id: "L-1",
      supplier_name: "Fresh Farms",
      vendor_id: "V-1",
      status: "Draft" as const,
      total_minor: 80000,
      created_by: "staff-1",
      lines: [{ id: "PL-1", po_id: "PO-1", stock_item_id: "S-1", quantity: "2", unit_cost_minor: 4000, total_minor: 8000 }],
      created_at: "2026-11-01T00:00:00Z",
      received_at: null,
    },
  ],
  recipes: [
    {
      id: "R-1",
      menu_item_id: "M-1",
      preparation_notes: null,
      ingredients: [{ stock_item_id: "S-1", quantity: { value: "2", unit: "kg" }, wastage_percent: "0" }],
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
  adjustStock: vi.fn(),
  createPurchaseOrder: vi.fn(),
  receivePurchaseOrder: vi.fn(),
  ingestAudit: vi.fn(),
}));

vi.mock("../providers/AuthProvider.js", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    client: {
      getInventory: vi.fn().mockResolvedValue(h.stock),
      listVendors: vi.fn().mockResolvedValue(h.vendors),
      listPurchaseOrders: vi.fn().mockResolvedValue(h.purchaseOrders),
      listRecipes: vi.fn().mockResolvedValue(h.recipes),
      getMenuCatalog: vi.fn().mockResolvedValue(h.catalog),
      adjustStock: h.adjustStock.mockResolvedValue({ item: h.stock[0] }),
      createPurchaseOrder: h.createPurchaseOrder.mockResolvedValue(h.purchaseOrders[0]),
      receivePurchaseOrder: h.receivePurchaseOrder.mockResolvedValue({ success: true }),
      ingestAudit: h.ingestAudit.mockResolvedValue(undefined),
    },
  }),
}));

// Also mock window.matchMedia if needed
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
        <InventoryPage />
      </App>
    </PlinthThemeProvider>,
  );
}

async function pickOption(label: string): Promise<void> {
  const dropdown = await waitFor(() => {
    const el = [...document.querySelectorAll(".ant-select-dropdown")].find(
      (d) => !d.classList.contains("ant-select-dropdown-hidden"),
    );
    if (el === null) throw new Error("dropdown not open");
    return el;
  });
  fireEvent.click(within(dropdown as HTMLElement).getByText(label));
}

describe("InventoryPage", () => {
  it("creates a purchase order through the client", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    fireEvent.click(screen.getByRole("button", { name: "New PO" }));
    // pick vendor: first select in the modal
    fireEvent.mouseDown(document.querySelector(".ant-select-selector") as HTMLElement);
    await pickOption("Fresh Farms");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Line" }));
    const submits = screen.getAllByRole("button", { name: "Submit PO" });
    fireEvent.click(submits[submits.length - 1] as HTMLElement);
    await waitFor(() => {
      expect(h.createPurchaseOrder).toHaveBeenCalledWith({
        vendor_id: "V-1",
        supplier_name: "Fresh Farms",
        lines: [{ stock_item_id: "S-1", quantity: "1", unit_cost_minor: 4000 }],
      });
    });
    expect(await screen.findByText("Purchase order created.")).toBeDefined();
  }, 60000);

  it("renders stock stats, levels and alerts from the API", async () => {
    renderPage();
    expect(await screen.findByText("Total SKUs")).toBeDefined();
    expect(await screen.findByText("Chicken Breast")).toBeDefined();
    expect(await screen.findByText(/Tomato is low/)).toBeDefined();
    expect(await screen.findByText("Purchase Orders")).toBeDefined();
    expect(await screen.findByText("Fresh Farms")).toBeDefined();
  });

  it("receives a purchase order from the PO table", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    const receiveButton = await screen.findByRole("button", { name: "Receive" });
    fireEvent.click(receiveButton);
    await waitFor(() => {
      expect(h.receivePurchaseOrder).toHaveBeenCalledWith("PO-1");
    });
    expect(await screen.findByText(/received into stock/)).toBeDefined();
  }, 60000);

  it("adjusts an ingredient through the client", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    const adjusts = screen.getAllByRole("button", { name: "Adjust" });
    fireEvent.click(adjusts[0] as HTMLElement);
    expect(await screen.findByText("Adjust Chicken Breast")).toBeDefined();
    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[spinbuttons.length - 1] as HTMLElement, { target: { value: 30 } });
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(h.adjustStock).toHaveBeenCalledWith({
        stock_item_id: "S-1",
        delta: "6",
        reason: "PhysicalCountCorrection",
        notes: null,
      });
    });
    expect(await screen.findByText(/set to 30 kg/)).toBeDefined();
  }, 60000);

  it("exposes recipes and vendors as tabs", async () => {
    renderPage();
    await screen.findByText("Chicken Breast");
    fireEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    expect(await screen.findByText("Avg Food Cost")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Vendors" }));
    expect(await screen.findByText("Vendor / Supplier Directory")).toBeDefined();
  });
});
