import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleBadge } from "./RoleBadge.js";

describe("RoleBadge", () => {
  it("renders owner with purple token", () => {
    render(<RoleBadge role="Owner" />);
    const el = screen.getByTestId("role-badge-owner");
    expect(el).toBeDefined();
    expect(el.getAttribute("style") ?? "").toContain("var(--p)");
    expect(screen.getByText("Owner")).toBeDefined();
  });

  it("renders each staff role with its color", () => {
    render(
      <>
        <RoleBadge role="Manager" />
        <RoleBadge role="Cashier" />
        <RoleBadge role="Kitchen" />
      </>,
    );
    expect(screen.getByTestId("role-badge-manager").getAttribute("style") ?? "").toContain("var(--bl)");
    expect(screen.getByTestId("role-badge-cashier").getAttribute("style") ?? "").toContain("var(--g)");
    expect(screen.getByTestId("role-badge-kitchen").getAttribute("style") ?? "").toContain("var(--o)");
  });
});
