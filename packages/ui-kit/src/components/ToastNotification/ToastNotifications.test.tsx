import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToastNotifications, toastManager } from "./ToastNotifications.js";

describe("ToastNotifications", () => {
  afterEach(() => {
    act(() => {
      toastManager.clear();
    });
  });

  it("renders nothing when there are no toasts", () => {
    render(<ToastNotifications />);
    expect(screen.queryByTestId("toast-stack")).toBeNull();
  });

  it("renders toasts added to the manager", () => {
    render(<ToastNotifications />);
    act(() => {
      toastManager.add({ type: "success", title: "Order saved" });
    });
    expect(screen.getByTestId("toast-stack")).toBeDefined();
    expect(screen.getByText("Order saved")).toBeDefined();
  });

  it("dismisses toast on close", () => {
    render(<ToastNotifications />);
    act(() => {
      toastManager.add({ type: "error", title: "Payment failed", message: "Retry" });
    });
    expect(screen.getByText("Payment failed")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText("Payment failed")).toBeNull();
  });
});
