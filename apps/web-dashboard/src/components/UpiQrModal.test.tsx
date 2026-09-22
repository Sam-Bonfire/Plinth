import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpiQrModal, buildUpiUri } from "./UpiQrModal.js";

describe("buildUpiUri", () => {
  it("builds a valid URI", () => {
    const uri = buildUpiUri("store@upi", "Plinth Store", 150.5);
    expect(uri).toBe("upi://pay?pa=store%40upi&pn=Plinth+Store&am=150.50&cu=INR");
  });

  it("handles optional note", () => {
    const uri = buildUpiUri("store@upi", "Plinth Store", 100, "Order 123");
    expect(uri).toBe("upi://pay?pa=store%40upi&pn=Plinth+Store&am=100.00&cu=INR&tn=Order+123");
  });

  it("returns empty string for zero amount", () => {
    const uri = buildUpiUri("store@upi", "Plinth Store", 0);
    expect(uri).toBe("");
  });

  it("returns empty string for negative amount", () => {
    const uri = buildUpiUri("store@upi", "Plinth Store", -50);
    expect(uri).toBe("");
  });

  it("formats amount to exactly two decimals", () => {
    const uri = buildUpiUri("store@upi", "Plinth Store", 99.999);
    expect(uri).toBe("upi://pay?pa=store%40upi&pn=Plinth+Store&am=100.00&cu=INR");
  });
});

describe("UpiQrModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    pa: "test@upi",
    pn: "Test Payee",
  };

  it("renders payee and amount input", () => {
    render(<UpiQrModal {...defaultProps} />);
    expect(screen.getByText("Payee: Test Payee")).toBeDefined();
    expect(document.querySelector(".ant-input-number")).toBeDefined();
  });

  it("shows warning when amount is 0", () => {
    render(<UpiQrModal {...defaultProps} />);
    expect(screen.getByText("Please enter a valid amount greater than 0 to generate the QR code.")).toBeDefined();
  });

  it("shows QR code when amount is greater than 0", () => {
    render(<UpiQrModal {...defaultProps} />);

    // Enter amount
    const input = document.querySelector(".ant-input-number-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100" } });

    // Warning should disappear
    expect(screen.queryByText("Please enter a valid amount greater than 0 to generate the QR code.")).toBeNull();

    // Formatted amount should appear
    expect(screen.getByText("₹100.00")).toBeDefined();

    // SVG should be rendered
    const svg = document.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("calls onClose when closed", async () => {
    const onClose = vi.fn();
    render(<UpiQrModal {...defaultProps} onClose={onClose} />);

    const closeBtn = (await screen.findAllByRole("button", { name: "Close" }))[0];
    if (closeBtn) fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
