import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloorPlanTable, FloorTableRow } from "./FloorPlanTable.js";

const rows: FloorTableRow[] = [
  { id: "t1", tableNumber: "T1", area: "Patio", capacity: 4, zone: "A", status: "Available" },
  { id: "t2", tableNumber: "T2", area: "Main", capacity: 2, zone: "B", status: "Occupied" },
];

describe("FloorPlanTable", () => {
  it("renders tabular floor plan with zones and status", () => {
    render(<FloorPlanTable data={rows} />);
    expect(screen.getByText("T1")).toBeDefined();
    expect(screen.getByText("T2")).toBeDefined();
    expect(screen.getByText("Available")).toBeDefined();
    expect(screen.getByText("Occupied")).toBeDefined();
    expect(screen.getByText("Area")).toBeDefined();
    expect(screen.getByText("Capacity")).toBeDefined();
  });
});
