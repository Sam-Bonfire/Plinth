import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashDropModal } from "./CashDropModal.js";
import type { CashDrop } from "./CashDropModal.js";

function renderModal(onSubmit: (drop: CashDrop) => void, onClose: () => void = (): void => {}): void {
  render(<CashDropModal open onClose={onClose} onSubmit={onSubmit} />);
}

describe("CashDropModal", () => {
  it("submits valid drops and resets", async () => {
    const submitted: CashDrop[] = [];
    renderModal((d) => {
      submitted.push(d);
    });
    const amount = document.querySelector(".ant-input-number-input") as HTMLElement;
    fireEvent.change(amount, { target: { value: "500" } });
    fireEvent.mouseDown(screen.getByText("Select a reason"));
    const options = await screen.findAllByText("Safe Drop");
    fireEvent.click(options[options.length - 1] as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Record Drop" }));
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.amount).toBe(500);
    expect(submitted[0]?.reason).toBe("Safe Drop");
  });

  it("blocks submit until amount and reason are set", async () => {
    const onSubmit = vi.fn();
    renderModal(onSubmit);
    const ok = await screen.findByRole("button", { name: "Record Drop" });
    expect(ok.getAttribute("disabled")).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes without submitting", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderModal(onSubmit, onClose);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
