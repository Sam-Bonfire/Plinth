import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrderChannelBadge } from "./OrderChannelBadge.js";
import { OrderStatusBadge } from "./OrderStatusBadge.js";

describe("OrderChannelBadge", () => {
  it("renders channel label correctly", () => {
    render(<OrderChannelBadge channel="DineIn" />);
    expect(screen.getByTestId("channel-badge-dinein").textContent).toBe("Dine-in");
  });

  it("applies correct color for Zomato", () => {
    render(<OrderChannelBadge channel="Zomato" />);
    const badge = screen.getByTestId("channel-badge-zomato");
    expect(badge.textContent).toBe("Zomato");
    expect(badge.style.color).toBe("var(--r)");
  });
});

describe("OrderStatusBadge", () => {
  it("renders status label correctly", () => {
    render(<OrderStatusBadge status="Ready" />);
    expect(screen.getByTestId("status-badge-ready").textContent).toBe("Ready");
  });

  it("applies pulse effect for Preparing status by default", () => {
    render(<OrderStatusBadge status="Preparing" />);
    const badge = screen.getByTestId("status-badge-preparing");
    expect(badge.className).toContain("plinth-pulse");
    expect(screen.getByTestId("pulse-dot")).toBeTruthy();
  });

  it("does not apply pulse effect for Draft status by default", () => {
    render(<OrderStatusBadge status="Draft" />);
    const badge = screen.getByTestId("status-badge-draft");
    expect(badge.className).not.toContain("plinth-pulse");
    expect(screen.queryByTestId("pulse-dot")).toBeNull();
  });

  it("applies pulse effect when explicitly requested", () => {
    render(<OrderStatusBadge status="Confirmed" pulse />);
    const badge = screen.getByTestId("status-badge-confirmed");
    expect(badge.className).toContain("plinth-pulse");
    expect(screen.getByTestId("pulse-dot")).toBeTruthy();
  });
});
