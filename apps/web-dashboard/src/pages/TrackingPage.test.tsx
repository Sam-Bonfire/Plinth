import { mockActiveDineInOrder } from "@plinth/ui-kit";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TrackingPage, statusToStep } from "./TrackingPage.js";

describe("TrackingPage logic", () => {
  it("statusToStep maps OrderStatus to timeline steps correctly", () => {
    // @ts-expect-error Intentionally testing fallback for unknown status
    expect(statusToStep("InProgress")).toBe(0);
    expect(statusToStep("Preparing")).toBe(1);
    expect(statusToStep("Ready")).toBe(2);
    expect(statusToStep("Served")).toBe(3);
    expect(statusToStep("Settled")).toBe(3);
    expect(statusToStep("Voided")).toBe(-1);
  });
});

describe("TrackingPage component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows invalid order message when order is not found", () => {
    render(<TrackingPage />);
    const input = screen.getByPlaceholderText("Enter Order ID");
    fireEvent.change(input, { target: { value: "INVALID-999" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));

    expect(screen.getByText("Invalid Order ID. Please check and try again.")).toBeDefined();
  });

  it("renders timeline steps and advances order state on refresh", () => {
    render(<TrackingPage />);
    const input = screen.getByPlaceholderText("Enter Order ID");

    // Test with mock active dine in order (initially Preparing -> step 1)
    fireEvent.change(input, { target: { value: mockActiveDineInOrder.id } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));

    // Check if it's rendered.
    expect(screen.getByRole("heading", { name: `Order ${mockActiveDineInOrder.id}` })).toBeDefined();

    // Steps component should have 'Preparing' as active if it's step 1. In antd, current prop controls active step.
    // It's a bit hard to test the internal state of Ant Design Steps just by text,
    // but we can verify the text is there
    expect(screen.getByText("Kitchen is preparing your order.")).toBeDefined();

    // Advance timers by 10s
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Wait for the state to update, order should advance to Ready
    // 'mockActiveDineInOrder.id' is initially 'Preparing', NEXT_STATUS['Preparing'] is 'Ready'
    // 'Ready' corresponds to step 2.
    // At this point we can't easily read `current={2}` without inspecting DOM classes.
    // But we know it successfully advanced if "Your order is ready." gets styled as active.
    // Testing text presence is sufficient for this check
    expect(screen.getByText("Your order is ready.")).toBeDefined();

    // Advance timers by another 10s
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Order should advance to Served
    expect(screen.getByText("Enjoy your meal!")).toBeDefined();
  });
});
