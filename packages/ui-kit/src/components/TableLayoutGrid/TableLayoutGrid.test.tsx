import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FloorTableRow } from "../FloorPlanTable/FloorPlanTable.js";
import { TableLayoutGrid } from "./TableLayoutGrid.js";

const tables: FloorTableRow[] = [
  { id: "T-01", tableNumber: "T-01", area: "Main", capacity: 4, zone: "Indoor", status: "Available" },
  { id: "T-02", tableNumber: "T-02", area: "Main", capacity: 2, zone: "Patio", status: "Occupied" },
  { id: "T-03", tableNumber: "T-03", area: "Main", capacity: 6, zone: "Indoor", status: "OutOfService" },
];

describe("TableLayoutGrid", () => {
  it("renders one card per table with status", () => {
    render(<TableLayoutGrid tables={tables} />);
    expect(screen.getByTestId("table-layout-grid")).toBeDefined();
    expect(screen.getByTestId("floor-table-T-01")).toBeDefined();
    expect(screen.getByText("4 seats · Indoor")).toBeDefined();
    expect(screen.getByText("Occupied")).toBeDefined();
    expect(screen.getByText("Out of service")).toBeDefined();
  });

  it("notifies on table select via click and keyboard", () => {
    const onSelect = vi.fn();
    render(<TableLayoutGrid tables={tables} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("floor-table-T-02"));
    expect(onSelect).toHaveBeenCalledWith("T-02");
    fireEvent.keyDown(screen.getByTestId("floor-table-T-01"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("T-01");
  });

  it("rings the selected table without layout shift", () => {
    render(<TableLayoutGrid tables={tables} selectedId="T-01" onSelect={vi.fn()} />);
    const style = screen.getByTestId("floor-table-T-01").getAttribute("style") ?? "";
    expect(style).toContain("box-shadow");
    expect(style).not.toContain("border-width");
  });

  it("renders empty state", () => {
    render(<TableLayoutGrid tables={[]} />);
    expect(screen.getByText("No tables on this floor yet.")).toBeDefined();
    expect(screen.queryByTestId("table-layout-grid")).toBeNull();
  });
});
