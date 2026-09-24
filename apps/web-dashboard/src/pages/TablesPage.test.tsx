import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { TablesPage, advanceTableStatus, closeTableOrder, openTableOrder, type FloorTable } from "./TablesPage.js";

describe("TablesPage", () => {
  it("renders tables with occupancy stats", async () => {
    render(<TablesPage />);
    const headings = await screen.findAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toContain("T-1");
    expect(headings.map((h) => h.textContent)).toContain("T-6");
    expect(screen.getAllByText("Occupied").length).toBeGreaterThan(0);
  });

  it("advances status on click for occupied tables", async () => {
    render(<TablesPage />);
    const headings = await screen.findAllByRole("heading", { level: 4 });
    const t2Heading = headings.find((el) => el.textContent === "T-2");
    const card = t2Heading?.closest(".ant-card") as HTMLElement;
    fireEvent.click(card);
    expect(await screen.findAllByText("Billing")).not.toHaveLength(0);
  });

  it("opens the seating modal for available tables and seats the party", async () => {
    render(<TablesPage />);
    const headings = await screen.findAllByRole("heading", { level: 4 });
    const t1Heading = headings.find((el) => el.textContent === "T-1");
    fireEvent.click(t1Heading?.closest(".ant-card") as HTMLElement);
    expect(await screen.findByText("Seat T-1")).toBeDefined();
    // Validation blocks save with no guest count
    fireEvent.click(screen.getByRole("button", { name: "Seat Party" }));
    expect(await screen.findByText("Party size must be at least 1.")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("Guest count"), { target: { value: 2 } });
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = await screen.findAllByText("Sana");
    fireEvent.click(options[options.length - 1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Seat Party" }));
    expect(await screen.findByText(/Party of 2 · Sana/)).toBeDefined();
  });

  it("cycles statuses deterministically", () => {
    expect(advanceTableStatus("Available")).toBe("Occupied");
    expect(advanceTableStatus("Occupied")).toBe("Billing");
    expect(advanceTableStatus("Billing")).toBe("Available");
    expect(advanceTableStatus("Reserved")).toBe("Available");
  });

  it("links seating to an order and clears it on close", () => {
    const free: FloorTable = { id: "T-9", label: "T-9", capacity: 4, status: "Available", partySize: 0, waiter: "", orderId: null };
    const seated = openTableOrder(free, 3, "Ravi", 1100);
    expect(seated.status).toBe("Occupied");
    expect(seated.orderId).toBe("ORD-1100");
    const closed = closeTableOrder(seated);
    expect(closed.status).toBe("Available");
    expect(closed.orderId).toBeNull();
    expect(closed.partySize).toBe(0);
  });

  it("shows the order id on the seated table card", async () => {
    render(<TablesPage />);
    const headings = await screen.findAllByRole("heading", { level: 4 });
    const t1Heading = headings.find((el) => el.textContent === "T-1");
    fireEvent.click(t1Heading?.closest(".ant-card") as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Guest count"), { target: { value: 2 } });
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = await screen.findAllByText("Sana");
    fireEvent.click(options[options.length - 1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Seat Party" }));
    expect(await screen.findByText(/ORD-1100/)).toBeDefined();
  });
});
