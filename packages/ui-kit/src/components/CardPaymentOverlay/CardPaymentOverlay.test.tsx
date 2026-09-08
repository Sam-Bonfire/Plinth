import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardPaymentOverlay } from "./CardPaymentOverlay.js";

describe("CardPaymentOverlay", () => {
  it("renders the amount while waiting", () => {
    render(<CardPaymentOverlay open amountMinor={125050} onCancel={vi.fn()} />);
    expect(screen.getByTestId("card-payment-overlay")).toBeDefined();
    expect(screen.getByText("₹1,250.50")).toBeDefined();
    expect(screen.getByLabelText("Waiting for card machine")).toBeDefined();
  });

  it("cancels the payment", () => {
    const onCancel = vi.fn();
    render(<CardPaymentOverlay open amountMinor={10000} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("card-payment-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    render(<CardPaymentOverlay open={false} amountMinor={10000} onCancel={vi.fn()} />);
    expect(screen.queryByTestId("card-payment-overlay")).toBeNull();
  });
});
