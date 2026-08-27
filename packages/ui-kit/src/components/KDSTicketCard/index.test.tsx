
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KDSTicketCard, KDSTicketItem } from "./index.js";

describe("KDSTicketCard", () => {
  const mockItems: KDSTicketItem[] = [
    { id: "1", name: "Burger", quantity: 2, modifiers: ["No Onion"] },
    { id: "2", name: "Fries", quantity: 1, completed: true },
  ];

  it("renders correctly with given props", () => {
    render(
      <KDSTicketCard
        ticketId="t-1"
        kotNumber={104}
        channel="DineIn"
        tableName="T5"
        elapsedSeconds={120}
        slaStatus="OnTime"
        items={mockItems}
        onBump={() => {}}
      />
    );

    expect(screen.getByText("#104")).toBeDefined();
    expect(screen.getByText("DineIn - T5")).toBeDefined();
    expect(screen.getByText("02:00")).toBeDefined(); // 120 seconds
    expect(screen.getByText("Burger")).toBeDefined();
    expect(screen.getByText("+ No Onion")).toBeDefined();
    expect(screen.getByText("Fries")).toBeDefined();
  });

  it("handles toggle item click", () => {
    const handleToggle = vi.fn();
    render(
      <KDSTicketCard
        ticketId="t-1"
        kotNumber={104}
        channel="DineIn"
        elapsedSeconds={0}
        slaStatus="OnTime"
        items={mockItems}
        onToggleItem={handleToggle}
        onBump={() => {}}
      />
    );

    const burgerItem = screen.getByText("Burger");
    fireEvent.click(burgerItem);
    expect(handleToggle).toHaveBeenCalledWith("1");
  });

  it("handles bump click", () => {
    const handleBump = vi.fn();
    render(
      <KDSTicketCard
        ticketId="t-1"
        kotNumber={104}
        channel="DineIn"
        elapsedSeconds={0}
        slaStatus="OnTime"
        items={mockItems}
        onBump={handleBump}
      />
    );

    const bumpBtn = screen.getByRole("button", { name: "BUMP" });
    fireEvent.click(bumpBtn);
    expect(handleBump).toHaveBeenCalled();
  });
});
