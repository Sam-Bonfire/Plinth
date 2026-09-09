import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarNavigation } from "./SidebarNavigation.js";

const items = [
  { key: "/pos", label: "POS" },
  { key: "/orders", label: "Orders" },
];

describe("SidebarNavigation", () => {
  it("renders brand and menu items", () => {
    render(<SidebarNavigation items={items} selectedKey="/pos" />);
    expect(screen.getByTestId("sidebar-brand")).toBeDefined();
    expect(screen.getByText("POS")).toBeDefined();
    expect(screen.getByText("Orders")).toBeDefined();
  });

  it("calls onNavigate with clicked key", () => {
    const onNavigate = vi.fn();
    render(<SidebarNavigation items={items} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Orders"));
    expect(onNavigate).toHaveBeenCalledWith("/orders");
  });

  it("renders footer slot", () => {
    render(<SidebarNavigation items={items} footer={<button>Outlet</button>} />);
    expect(screen.getByText("Outlet")).toBeDefined();
  });
});
