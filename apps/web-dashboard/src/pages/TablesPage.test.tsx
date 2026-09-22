import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TablesPage, advanceTableStatus } from "./TablesPage.js";

describe("TablesPage", () => {
  it("renders tables with occupancy stats", async () => {
    render(<TablesPage />);
    expect(await screen.findByText("T-1")).toBeDefined();
    expect(await screen.findByText("T-6")).toBeDefined();
    expect(screen.getAllByText("Occupied").length).toBeGreaterThan(0);
  });

  it("advances status on click", async () => {
    render(<TablesPage />);
    await screen.findByText("T-1");
    const card = screen.getByText("T-1").closest(".ant-card") as HTMLElement;
    fireEvent.click(card);
    expect(await screen.findAllByText("Occupied")).not.toHaveLength(0);
  });

  it("cycles statuses deterministically", () => {
    expect(advanceTableStatus("Available")).toBe("Occupied");
    expect(advanceTableStatus("Occupied")).toBe("Billing");
    expect(advanceTableStatus("Billing")).toBe("Available");
    expect(advanceTableStatus("Reserved")).toBe("Available");
  });
});
