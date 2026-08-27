import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModalWrapper } from "./ModalWrapper";

describe("ModalWrapper", () => {
  it("renders children and title when open is true", () => {
    render(
      <ModalWrapper open={true} title="Test Title" onClose={() => {}}>
        <div data-testid="modal-content">Modal Content</div>
      </ModalWrapper>
    );

    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByTestId("modal-content")).toBeDefined();
  });

  it("does not render content when open is false", () => {
    render(
      <ModalWrapper open={false} title="Test Title" onClose={() => {}}>
        <div data-testid="modal-content">Modal Content</div>
      </ModalWrapper>
    );
    expect(screen.queryByTestId("modal-content")).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <ModalWrapper open={true} title="Test Title" onClose={handleClose}>
        <div data-testid="modal-content">Modal Content</div>
      </ModalWrapper>
    );

    const closeButton = screen.getAllByLabelText("Close")[0];
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
