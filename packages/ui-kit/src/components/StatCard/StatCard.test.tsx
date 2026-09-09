import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard.js";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Gross Revenue" value={125000} />);
    expect(screen.getByText("Gross Revenue")).toBeDefined();
    expect(screen.getByText("125,000")).toBeDefined();
  });

  it("renders delta suffix", () => {
    render(<StatCard title="Orders" value={42} delta="+12%" tone="success" />);
    expect(screen.getByText("+12%")).toBeDefined();
  });

  it("applies danger tone color to value", () => {
    const { container } = render(<StatCard title="Late" value={3} tone="danger" />);
    const valueEl = container.querySelector(".ant-statistic-content");
    expect(valueEl?.getAttribute("style") ?? "").toContain("var(--r)");
  });
});
