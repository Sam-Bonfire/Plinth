import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KDSTicketCard } from "./KDSTicketCard";

describe("KDSTicketCard", () => {
  const mockItems = [
    { id: "1", name: "Burger", quantity: 2, modifiers: ["No onions"], notes: "Extra crispy" },
    { id: "2", name: "Fries", quantity: 1, completed: true },
  ];

  it("renders header, timer, and items correctly", () => {
    render(
      <KDSTicketCard
        ticketId="T1"
        kotNumber={104}
        channel="DineIn"
        tableName="Table 4"
        elapsedSeconds={125}
        slaStatus="OnTime"
        items={mockItems}
        onBump={() => {}}
      />
    );

    expect(screen.getByText("#104")).toBeDefined();
    expect(screen.getByText("DineIn")).toBeDefined();
    expect(screen.getByText("Table 4")).toBeDefined();
    expect(screen.getByText("02:05")).toBeDefined();

    expect(screen.getByText("2x Burger")).toBeDefined();
    expect(screen.getByText("+ No onions")).toBeDefined();
    expect(screen.getByText("Note: Extra crispy")).toBeDefined();
    expect(screen.getByText("1x Fries")).toBeDefined();
  });

  it("calls onToggleItem when an item is clicked", () => {
    const handleToggle = vi.fn();
    render(
      <KDSTicketCard
        ticketId="T1"
        kotNumber={104}
        channel="DineIn"
        elapsedSeconds={125}
        slaStatus="Warning"
        items={mockItems}
        onToggleItem={handleToggle}
        onBump={() => {}}
      />
    );

    const burgerItem = screen.getByText("2x Burger").closest("div");
    expect(burgerItem).not.toBeNull();
    fireEvent.click(burgerItem!);
    expect(handleToggle).toHaveBeenCalledWith("1");
  });

  it("calls onBump when bump button is clicked", () => {
    const handleBump = vi.fn();
    render(
      <KDSTicketCard
        ticketId="T1"
        kotNumber={104}
        channel="DineIn"
        elapsedSeconds={125}
        slaStatus="Late"
        items={mockItems}
        onBump={handleBump}
      />
    );

    const bumpButton = screen.getByText("BUMP");
    fireEvent.click(bumpButton);
    expect(handleBump).toHaveBeenCalledTimes(1);
  });
});
