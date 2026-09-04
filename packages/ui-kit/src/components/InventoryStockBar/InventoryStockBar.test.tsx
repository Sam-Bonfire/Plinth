import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InventoryStockBar } from "./InventoryStockBar.js";

describe("InventoryStockBar", () => {
  it("renders with healthy state (emerald)", () => {
    render(<InventoryStockBar current={80} max={100} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("80");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");

    const fill = screen.getByTestId("stock-bar-fill");
    // Should use var(--g) for healthy state
    expect(fill.style.backgroundColor).toBe("var(--g)");
    expect(fill.style.width).toBe("80%");
  });

  it("renders with warning state (amber) at default threshold", () => {
    // default threshold is 20%
    render(<InventoryStockBar current={20} max={100} />);
    const fill = screen.getByTestId("stock-bar-fill");
    expect(fill.style.backgroundColor).toBe("var(--y)");
  });

  it("renders with critical state (rose) for zero stock", () => {
    render(<InventoryStockBar current={0} max={100} />);
    const fill = screen.getByTestId("stock-bar-fill");
    expect(fill.style.backgroundColor).toBe("var(--r)");
    expect(fill.style.width).toBe("0%");
  });

  it("renders with critical state (rose) for negative stock", () => {
    render(<InventoryStockBar current={-5} max={100} />);
    const fill = screen.getByTestId("stock-bar-fill");
    expect(fill.style.backgroundColor).toBe("var(--r)");
    expect(fill.style.width).toBe("0%");
  });

  it("caps width at 100% when current exceeds max", () => {
    render(<InventoryStockBar current={150} max={100} />);
    const fill = screen.getByTestId("stock-bar-fill");
    expect(fill.style.backgroundColor).toBe("var(--g)");
    expect(fill.style.width).toBe("100%");
  });

  it("renders with warning state (amber) using custom threshold", () => {
    render(<InventoryStockBar current={45} max={100} lowThreshold={50} />);
    const fill = screen.getByTestId("stock-bar-fill");
    expect(fill.style.backgroundColor).toBe("var(--y)");
  });

  it("renders label and percentage when showLabel is true", () => {
    render(<InventoryStockBar current={45} max={100} showLabel unit="kg" />);
    // Screen should contain "45 / 100", "kg", "45%"
    const labelParent = screen.getByText(/45 \/ 100/);
    expect(labelParent).toBeTruthy();

    const unitSpan = screen.getByText("kg");
    expect(unitSpan).toBeTruthy();

    const percentSpan = screen.getByText("45%");
    expect(percentSpan).toBeTruthy();
  });

  it("does not render label when showLabel is false", () => {
    const { container } = render(<InventoryStockBar current={45} max={100} unit="kg" showLabel={false} />);
    const percentMatch = Array.from(container.querySelectorAll("span")).find(span => span.textContent?.includes("45%"));
    expect(percentMatch).toBeFalsy();
  });

  it("applies different heights based on size prop", () => {
    const { rerender } = render(<InventoryStockBar current={50} max={100} size="sm" />);
    let progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.height).toBe("4px");

    rerender(<InventoryStockBar current={50} max={100} size="md" />);
    progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.height).toBe("8px");

    rerender(<InventoryStockBar current={50} max={100} size="lg" />);
    progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.height).toBe("12px");
  });
});
