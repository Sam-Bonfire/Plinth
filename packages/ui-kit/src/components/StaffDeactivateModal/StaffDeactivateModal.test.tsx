import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaffDeactivateModal } from "./StaffDeactivateModal.js";

describe("StaffDeactivateModal", () => {
  it("names the staff member and explains consequences", () => {
    render(<StaffDeactivateModal open staffName="Divya R" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("staff-deactivate-modal")).toBeDefined();
    expect(screen.getByText("Deactivate Divya R")).toBeDefined();
  });

  it("requires a reason before confirming", () => {
    render(<StaffDeactivateModal open staffName="Divya R" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("deactivate-confirm")).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("deactivate-reason"), { target: { value: "   " } });
    expect(screen.getByTestId("deactivate-confirm")).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByTestId("deactivate-reason"), { target: { value: "Resigned" } });
    expect(screen.getByTestId("deactivate-confirm")).toHaveProperty("disabled", false);
  });

  it("confirms with the trimmed reason", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<StaffDeactivateModal open staffName="Divya R" onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("deactivate-reason"), { target: { value: "  Resigned  " } });
    fireEvent.click(screen.getByTestId("deactivate-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("Resigned");
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the reason when reopened", () => {
    const { rerender } = render(
      <StaffDeactivateModal open={false} staffName="Divya R" onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    rerender(<StaffDeactivateModal open staffName="Divya R" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("deactivate-reason")).toHaveProperty("value", "");
  });
});
