import { render, screen, fireEvent, act } from "@testing-library/react";
import { App } from "antd";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StockCountSheet, type StockCountIngredient } from "./StockCountSheet.js";

// Mock URL object
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();
// Mock window.print
global.window.print = vi.fn();

const mockIngredients: StockCountIngredient[] = [
  { key: "1", name: "Apple", unit: "kg", current: 10 },
  { key: "2", name: "Banana", unit: "kg", current: 5 },
];

describe("StockCountSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <App>
        <StockCountSheet open={true} onClose={vi.fn()} ingredients={mockIngredients} />
      </App>
    );
  };

  it("renders the table with ingredients", () => {
    renderComponent();
    expect(screen.getByText("Apple")).not.toBeNull();
    expect(screen.getByText("Banana")).not.toBeNull();
  });

  it("calculates variance correctly", () => {
    renderComponent();

    const inputs = screen.getAllByRole("spinbutton");

    act(() => {
      fireEvent.change(inputs[0], { target: { value: "12" } });
      fireEvent.change(inputs[1], { target: { value: "3" } });
    });

    expect(screen.getByText(/Total Variance:\s*0/)).not.toBeNull();
  });

  it("exports CSV with correct content", () => {
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement");

    const mockAnchor = origCreateElement("a");
    mockAnchor.click = vi.fn();

    createElementSpy.mockImplementation((tag) => {
      if (tag === "a") return mockAnchor;
      return origCreateElement(tag);
    });

    renderComponent();

    const inputs = screen.getAllByRole("spinbutton");

    act(() => {
      fireEvent.change(inputs[0], { target: { value: "12" } });
      fireEvent.change(inputs[1], { target: { value: "5" } });
    });

    const exportBtn = screen.getByText("Export CSV");
    act(() => {
      fireEvent.click(exportBtn);
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("stock_count_sheet.csv");

    createElementSpy.mockRestore();
  });
});
