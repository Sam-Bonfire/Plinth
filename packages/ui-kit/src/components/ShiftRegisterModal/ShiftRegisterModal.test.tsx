import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShiftRegisterModal } from "./ShiftRegisterModal.js";

describe("ShiftRegisterModal", () => {
  it("renders terminal label and opening float input", () => {
    render(<ShiftRegisterModal open terminalLabel="POS-02 · Koramangala" onClose={vi.fn()} onOpenRegister={vi.fn()} />);
    expect(screen.getByTestId("shift-register-modal")).toBeDefined();
    expect(screen.getByText("POS-02 · Koramangala")).toBeDefined();
  });

  it("keeps confirm disabled until a non-negative float is entered", () => {
    render(<ShiftRegisterModal open onClose={vi.fn()} onOpenRegister={vi.fn()} />);
    expect(screen.getByTestId("register-open-confirm")).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5000" } });
    expect(screen.getByTestId("register-open-confirm")).toHaveProperty("disabled", false);
  });

  it("opens the register with the entered float", () => {
    const onOpenRegister = vi.fn();
    const onClose = vi.fn();
    render(<ShiftRegisterModal open onClose={onClose} onOpenRegister={onOpenRegister} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5000" } });
    fireEvent.click(screen.getByTestId("register-open-confirm"));
    expect(onOpenRegister).toHaveBeenCalledWith(5000);
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the float when reopened", () => {
    const { rerender } = render(
      <ShiftRegisterModal open={false} onClose={vi.fn()} onOpenRegister={vi.fn()} />,
    );
    rerender(<ShiftRegisterModal open onClose={vi.fn()} onOpenRegister={vi.fn()} />);
    expect(screen.getByRole("spinbutton").getAttribute("value")).toBe("");
  });
});
