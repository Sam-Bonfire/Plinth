import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PurchaseOrderCreator, poTotal, validatePo, type PoLine } from "./PurchaseOrderCreator.js";

const lines: PoLine[] = [
  { key: "L-1", item: "Tomato", qty: 10, unitCost: 40 },
  { key: "L-2", item: "Milk", qty: 5, unitCost: 60 },
];

describe("poTotal", () => {
  it("sums qty * unitCost across lines", () => {
    expect(poTotal(lines)).toBe(700);
    expect(poTotal([])).toBe(0);
  });
});

describe("validatePo", () => {
  it("accepts a complete PO", () => {
    expect(validatePo("Fresh Farms", lines)).toEqual([]);
  });

  it("rejects missing supplier, empty lines, and non-positive qty/cost", () => {
    expect(validatePo("", lines)).toContain("Supplier is required.");
    expect(validatePo("Fresh Farms", [])).toContain("Add at least one line.");
    expect(validatePo("Fresh Farms", [{ ...lines[0], qty: 0 } as PoLine])).toContain("Quantities must be > 0.");
    expect(validatePo("Fresh Farms", [{ ...lines[0], unitCost: 0 } as PoLine])).toContain("Unit costs must be > 0.");
  });
});

describe("PurchaseOrderCreator", () => {
  it("restores a saved draft and submits the PO", async () => {
    localStorage.setItem("plinth-po-draft", JSON.stringify({ supplier: "Fresh Farms", lines }));
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<PurchaseOrderCreator items={["Tomato", "Milk"]} open={true} onClose={onClose} onSubmit={onSubmit} />);

    expect((screen.getByPlaceholderText("Supplier name") as HTMLInputElement).value).toBe("Fresh Farms");
    fireEvent.click(screen.getByRole("button", { name: "Submit PO" }));
    expect(onSubmit).toHaveBeenCalledWith({ supplier: "Fresh Farms", lines, total: 700 });
    localStorage.clear();
  });

  it("blocks submit with an error when supplier is missing", async () => {
    const onSubmit = vi.fn();
    render(<PurchaseOrderCreator items={["Tomato"]} open={true} onClose={(): void => undefined} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Line" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit PO" }));
    expect(onSubmit).not.toHaveBeenCalled();
    localStorage.clear();
  });
});
