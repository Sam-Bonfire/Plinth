import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderBuilder } from "./OrderBuilder.js";

describe("OrderBuilder", () => {
  it("renders empty state and running total", () => {
    render(<OrderBuilder items={[]} onAddItem={vi.fn()} onRemoveItem={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("No items")).toBeDefined();
    expect(screen.getByText(/Total:/)).toBeDefined();
  });

  it("renders items and running total calculation", () => {
    render(
      <OrderBuilder
        items={[
          { menuItemId: "item-1", name: "Pizza", unitPriceMinor: 10000, quantity: 2, taxRate: "FivePercent", seatNumber: null, notes: null },
        ]}
        onAddItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText(/Pizza/)).toBeDefined();
    expect(screen.getByText(/₹200.00/)).toBeDefined();
  });
});
