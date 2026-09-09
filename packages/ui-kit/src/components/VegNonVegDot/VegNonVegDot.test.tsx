import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VegNonVegDot } from "./VegNonVegDot.js";

describe("VegNonVegDot", () => {
  it("renders veg mark with green border", () => {
    render(<VegNonVegDot isVeg={true} />);
    const el = screen.getByTestId("veg-dot");
    expect(el).toBeDefined();
    expect(el.getAttribute("style") ?? "").toContain("var(--g)");
    expect(el.getAttribute("aria-label")).toBe("Vegetarian mark");
  });

  it("renders non-veg mark with red border", () => {
    render(<VegNonVegDot isVeg={false} />);
    const el = screen.getByTestId("nonveg-dot");
    expect(el).toBeDefined();
    expect(el.getAttribute("style") ?? "").toContain("var(--r)");
    expect(el.getAttribute("aria-label")).toBe("Non-vegetarian mark");
  });

  it("respects custom size", () => {
    render(<VegNonVegDot isVeg={true} size={24} />);
    const el = screen.getByTestId("veg-dot");
    expect(el.getAttribute("style") ?? "").toContain("24px");
  });
});
