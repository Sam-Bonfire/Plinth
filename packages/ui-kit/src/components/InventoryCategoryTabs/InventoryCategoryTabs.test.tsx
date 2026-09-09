import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InventoryCategoryTabs } from "./InventoryCategoryTabs.js";

describe("InventoryCategoryTabs", () => {
  it("renders all plus one tab per category", () => {
    render(<InventoryCategoryTabs categories={["Dairy", "Produce"]} onChange={vi.fn()} />);
    expect(screen.getByTestId("inventory-category-tabs")).toBeDefined();
    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByText("Dairy")).toBeDefined();
    expect(screen.getByText("Produce")).toBeDefined();
  });

  it("notifies on category pick", () => {
    const onChange = vi.fn();
    render(<InventoryCategoryTabs categories={["Dairy"]} onChange={onChange} />);
    const label = screen.getByText("Dairy");
    const item = label.closest(".ant-segmented-item");
    expect(item).not.toBeNull();
    if (item !== null) {
      fireEvent.click(item);
    }
    expect(onChange).toHaveBeenCalledWith("Dairy");
  });
});
