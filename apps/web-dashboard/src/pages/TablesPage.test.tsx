import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { TablesPage, advanceTableStatus } from "./TablesPage.js";

describe("TablesPage", () => {
  it("renders tables with occupancy stats", async () => {
    render(<TablesPage />);
    const headings = await screen.findAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toContain("T-1");
    expect(headings.map((h) => h.textContent)).toContain("T-6");
    expect(screen.getAllByText("Occupied").length).toBeGreaterThan(0);
  });

  it("advances status on click", async () => {
    render(<TablesPage />);
    const t1Heading = (await screen.findAllByRole("heading", { level: 4 })).find((el) => el.textContent === "T-1");
    const card = t1Heading?.closest(".ant-card") as HTMLElement;
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
