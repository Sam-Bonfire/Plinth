import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiderPickupModal } from "./RiderPickupModal.js";

function renderModal(onConfirm: (otp: string) => void, onClose: () => void = (): void => {}): void {
  render(<RiderPickupModal open onClose={onClose} onConfirm={onConfirm} orderId="ORD-123" platform="Swiggy" />);
}

describe("RiderPickupModal", () => {
  it("blocks short OTPs", async () => {
    const onConfirm = vi.fn();
    renderModal(onConfirm);
    const input = screen.getByPlaceholderText("Enter 4-6 digit OTP") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("OTP must be a 4 to 6 digit number.")).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("passes valid OTP code to onConfirm", async () => {
    const onConfirm = vi.fn();
    renderModal(onConfirm);
    const input = screen.getByPlaceholderText("Enter 4-6 digit OTP") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("1234");
  });

  it("closes modal on cancel", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderModal(onConfirm, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
