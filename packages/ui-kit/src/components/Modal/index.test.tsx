
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModalWrapper } from "./index.js";

describe("ModalWrapper", () => {
  it("renders correctly when open is true", () => {
    const handleClose = vi.fn();
    render(
      <ModalWrapper open={true} title="Test Modal" onClose={handleClose}>
        <div data-testid="modal-content">Modal Content</div>
      </ModalWrapper>
    );

    expect(screen.getByText("Test Modal")).toBeDefined();
    expect(screen.getByTestId("modal-content")).toBeDefined();
  });

  it("does not render when open is false", () => {
    const handleClose = vi.fn();
    render(
      <ModalWrapper open={false} title="Test Modal" onClose={handleClose}>
        <div data-testid="modal-content">Modal Content</div>
      </ModalWrapper>
    );

    const element = screen.queryByTestId("modal-content");
    expect(element).toBeNull();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    render(
      <ModalWrapper open={true} title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </ModalWrapper>
    );

    const closeButtons = screen.getAllByLabelText("Close");
    fireEvent.click(closeButtons[0]);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
