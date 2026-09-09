import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierBadge } from "./TierBadge.js";

describe("TierBadge", () => {
  it("renders gold with yellow token", () => {
    render(<TierBadge tier="Gold" />);
    const el = screen.getByTestId("tier-badge-gold");
    expect(el).toBeDefined();
    expect(el.getAttribute("style") ?? "").toContain("var(--y)");
    expect(screen.getByText("Gold")).toBeDefined();
  });

  it("renders remaining tiers with readable colors", () => {
    render(
      <>
        <TierBadge tier="Silver" />
        <TierBadge tier="Bronze" />
        <TierBadge tier="New" />
      </>,
    );
    expect(screen.getByTestId("tier-badge-silver").getAttribute("style") ?? "").toContain("var(--acc)");
    expect(screen.getByTestId("tier-badge-bronze").getAttribute("style") ?? "").toContain("var(--o)");
    expect(screen.getByTestId("tier-badge-new").getAttribute("style") ?? "").toContain("var(--g)");
  });
});
