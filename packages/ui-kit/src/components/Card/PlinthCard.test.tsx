import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlinthCard } from "./PlinthCard.js";

describe("PlinthCard", () => {
  it("renders children in body", () => {
    render(<PlinthCard>Card Content</PlinthCard>);
    expect(screen.getByTestId("plinth-card-body").textContent).toBe("Card Content");
  });

  it("renders title and subtitle", () => {
    render(<PlinthCard title="Main Title" subtitle="Sub Title" />);
    expect(screen.getByTestId("plinth-card-title").textContent).toBe("Main Title");
    expect(screen.getByTestId("plinth-card-subtitle").textContent).toBe("Sub Title");
  });

  it("renders action slots", () => {
    render(
      <PlinthCard actionSlots={<button data-testid="action-btn">Action</button>} />
    );
    expect(screen.getByTestId("action-btn")).toBeTruthy();
  });

  it("applies variant styles correctly", () => {
    const { rerender } = render(<PlinthCard variant="flat" />);
    let card = screen.getByTestId("plinth-card");
    expect(card.style.backgroundColor).toBe("transparent");

    rerender(<PlinthCard variant="elevated" />);
    card = screen.getByTestId("plinth-card");
    expect(card.style.boxShadow).toContain("rgba(0, 0, 0, 0.1)");
  });
});
