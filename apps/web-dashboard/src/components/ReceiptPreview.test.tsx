import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { ReceiptPreview, formatReceiptLines, type OrderProp } from "./ReceiptPreview.js";

describe("ReceiptPreview", () => {
  const mockOrder: OrderProp = {
    store_name: "PLINTH CAFE",
    lines: [
      { name: "Masala Dosa", qty: 2, price_minor: 12000 }, // 120.00
      { name: "Coffee", qty: 1, price_minor: 4500 }, // 45.00
    ],
    tax_minor: 1425, // 14.25
    total_minor: 29925, // 299.25
    txn_id: "ORD-1234",
    timestamp: "2023-10-25 14:30:00",
  };

  it("formats receipt lines into exactly 42 columns", () => {
    const lines = formatReceiptLines(mockOrder);

    // Check all lines are exactly 42 length
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(42);
      if (line.length > 0 && !line.includes("-")) {
        expect(line.length).toBe(42); // Most formatted lines should be exactly 42
      }
    }

    // Check specific line formatting
    // Masala Dosa x2                            240.00
    const firstItemLine = lines.find((l) => l.includes("Masala Dosa"));
    expect(firstItemLine).toBe("Masala Dosa x2                      240.00");

    // Coffee x1                                  45.00
    const secondItemLine = lines.find((l) => l.includes("Coffee"));
    expect(secondItemLine).toBe("Coffee x1                            45.00");

    // Totals
    const subtotalLine = lines.find((l) => l.includes("SUBTOTAL"));
    expect(subtotalLine).toBe("SUBTOTAL                            285.00");
  });

  it("truncates item names that are too long to fit with price", () => {
    const longOrder: OrderProp = {
      ...mockOrder,
      lines: [
        { name: "This is a very long item name that will definitely not fit on one line with the price", qty: 1, price_minor: 50000 },
      ],
    };
    const lines = formatReceiptLines(longOrder);
    const itemLine = lines.find((l) => l.includes("This is a very long"));
    expect(itemLine).toBeDefined();
    expect(itemLine!.length).toBe(42);
    expect(itemLine!.endsWith("500.00")).toBe(true);
  });

  it("renders ReceiptPreview modal and handles copy and print", async () => {
    const mockPrint = vi.fn();
    global.window.print = mockPrint;

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });

    const onClose = vi.fn();

    render(
      <App>
        <ReceiptPreview order={mockOrder} onClose={onClose} />
      </App>
    );

    // Assert rendered lines
    expect(screen.getByText(/PLINTH CAFE/)).toBeInTheDocument();
    expect(screen.getByText(/Masala Dosa/)).toBeInTheDocument();

    // Test print
    const printBtn = screen.getByRole("button", { name: "Print" });
    fireEvent.click(printBtn);
    expect(mockPrint).toHaveBeenCalled();

    // Test copy
    const copyBtn = screen.getByRole("button", { name: "Copy Text" });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
