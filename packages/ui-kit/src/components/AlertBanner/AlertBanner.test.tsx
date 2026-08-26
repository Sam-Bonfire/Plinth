import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { AlertBanner } from "./AlertBanner";

describe("AlertBanner", () => {
  it("renders message and description", () => {
    render(
      <AlertBanner type="info" message="Info message" description="Info description" />
    );
    expect(screen.getByText("Info message")).toBeDefined();
    expect(screen.getByText("Info description")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <AlertBanner type="warning" message="Warning" closable onClose={handleClose} />
    );

    const closeButton = screen.getByLabelText("close");
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
