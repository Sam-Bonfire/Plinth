import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PurchaseOrderCreator, poTotal, validatePo, type PoLine, type StockItemOption, type VendorOption } from "./PurchaseOrderCreator.js";

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

const lines: PoLine[] = [
  { key: "L-1", stockItemId: "S-1", qty: 10, unitCostMinor: 4000 },
  { key: "L-2", stockItemId: "S-2", qty: 5, unitCostMinor: 6000 },
];

const vendors: VendorOption[] = [
  { id: "V-1", name: "Fresh Farms" },
  { id: "V-2", name: "Quality Meats" },
];

const stockItems: StockItemOption[] = [
  { id: "S-1", name: "Tomato", unit: "kg", unitCostMinor: 4000 },
  { id: "S-2", name: "Milk", unit: "L", unitCostMinor: 6000 },
];

describe("poTotal", () => {
  it("sums qty * unitCostMinor across lines", () => {
    expect(poTotal(lines)).toBe(70000);
    expect(poTotal([])).toBe(0);
  });
});

describe("validatePo", () => {
  it("accepts a complete PO", () => {
    expect(validatePo("V-1", lines)).toEqual([]);
  });

  it("rejects missing vendor, empty lines, and non-positive qty/cost", () => {
    expect(validatePo("", lines)).toContain("Vendor is required.");
    expect(validatePo("V-1", [])).toContain("Add at least one line.");
    expect(validatePo("V-1", [{ ...lines[0], qty: 0 } as PoLine])).toContain("Quantities must be > 0.");
    expect(validatePo("V-1", [{ ...lines[0], unitCostMinor: 0 } as PoLine])).toContain("Unit costs must be > 0.");
  });
});

function renderCreator(onSubmit: (req: unknown) => void): void {
  render(
    <PurchaseOrderCreator
      vendors={vendors}
      stockItems={stockItems}
      open={true}
      onClose={(): void => undefined}
      onSubmit={onSubmit}
    />,
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

describe("PurchaseOrderCreator", () => {
  it("submits a typed request after selecting vendor and lines", async () => {
    const onSubmit = vi.fn();
    renderCreator(onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "+ Add Line" }));
    // First line auto-fills the first stock item with its unit cost.
    fireEvent.mouseDown(document.querySelector(".ant-select-selector") as HTMLElement);
    await pickOption("Fresh Farms");

    fireEvent.click(screen.getByRole("button", { name: "Submit PO" }));
    expect(onSubmit).toHaveBeenCalledWith({
      vendor_id: "V-1",
      supplier_name: "Fresh Farms",
      lines: [{ stock_item_id: "S-1", quantity: "1", unit_cost_minor: 4000 }],
    });
  });

  it("blocks submit when the vendor is missing", () => {
    const onSubmit = vi.fn();
    renderCreator(onSubmit);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Line" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit PO" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
