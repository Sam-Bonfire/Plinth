import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LowStockAlerts } from "./LowStockAlerts.js";

const items = [
  { key: "ING-03", name: "Tomato", current: 3, unit: "kg", par: 10, severity: "Low" as const },
  { key: "ING-04", name: "Garam Masala", current: 0, unit: "kg", par: 5, severity: "Critical" as const },
];

describe("LowStockAlerts", () => {
  it("renders one banner per low item", () => {
    render(<LowStockAlerts items={items} />);
    expect(screen.getByTestId("low-stock-alerts")).toBeDefined();
    expect(screen.getByText("Tomato is low")).toBeDefined();
    expect(screen.getByText("3 kg on hand vs PAR 10 kg.")).toBeDefined();
    expect(screen.getByText("Garam Masala is critical")).toBeDefined();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts.some((el) => el.className.includes("ant-alert-error"))).toBe(true);
    expect(alerts.some((el) => el.className.includes("ant-alert-warning"))).toBe(true);
  });

  it("renders the all-clear empty state", () => {
    render(<LowStockAlerts items={[]} />);
    expect(screen.getByText("All ingredients above PAR.")).toBeDefined();
  });
});
