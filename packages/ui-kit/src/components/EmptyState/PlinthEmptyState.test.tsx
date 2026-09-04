import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlinthEmptyState } from "./PlinthEmptyState.js";

describe("PlinthEmptyState", () => {
  it("renders with default props", () => {
    render(<PlinthEmptyState />);
    expect(screen.getByText("No Data")).toBeTruthy();
    expect(screen.getByText("There is no data to display here.")).toBeTruthy();
  });

  it("renders with 'no-orders' preset", () => {
    render(<PlinthEmptyState preset="no-orders" />);
    expect(screen.getByText("No Orders")).toBeTruthy();
    expect(screen.getByText("There are currently no orders to display.")).toBeTruthy();
  });

  it("renders with 'empty-cart' preset", () => {
    render(<PlinthEmptyState preset="empty-cart" />);
    expect(screen.getByText("Empty Cart")).toBeTruthy();
    expect(screen.getByText("Add items to the cart to begin.")).toBeTruthy();
  });

  it("allows custom title and description to override preset", () => {
    render(
      <PlinthEmptyState
        preset="no-search-results"
        title="Custom Title"
        description="Custom Description"
      />
    );
    expect(screen.getByText("Custom Title")).toBeTruthy();
    expect(screen.getByText("Custom Description")).toBeTruthy();
    expect(screen.queryByText("No Results Found")).toBeNull();
  });

  it("renders a CTA button when actionText and onAction are provided", () => {
    const handleAction = vi.fn();
    render(
      <PlinthEmptyState
        actionText="Try Again"
        onAction={handleAction}
      />
    );
    const button = screen.getByRole("button", { name: "Try Again" });
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("does not render a CTA button when only actionText is provided", () => {
    render(<PlinthEmptyState actionText="Try Again" />);
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  });

  it("renders with a custom icon", () => {
    render(
      <PlinthEmptyState
        icon={<div data-testid="custom-icon" />}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });
});
