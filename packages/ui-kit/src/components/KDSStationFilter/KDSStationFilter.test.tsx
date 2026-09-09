import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KDSStationFilter } from "./KDSStationFilter.js";
describe("KDSStationFilter", () => {
  it("renders all-stations plus one option per station with counts", () => {
    render(<KDSStationFilter stations={["Tandoor", "Grill"]} counts={{ Tandoor: 2 }} onChange={vi.fn()} />);
    expect(screen.getByText("All stations")).toBeDefined();
    expect(screen.getByText("Tandoor")).toBeDefined();
    expect(screen.getByText("Grill")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("selects all by default and notifies on station pick", () => {
    const onChange = vi.fn();
    render(<KDSStationFilter stations={["Tandoor"]} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /all stations/i }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByText("Tandoor"));
    expect(onChange).toHaveBeenCalledWith("Tandoor");
  });
});
