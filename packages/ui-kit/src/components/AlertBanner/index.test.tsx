
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AlertBanner } from "./index.js";

describe("AlertBanner", () => {
  it("renders correctly with given props", () => {
    render(
      <AlertBanner
        type="warning"
        message="Warning Message"
        description="Warning Description"
        action={<button>Action</button>}
      />
    );

    expect(screen.getByText("Warning Message")).toBeDefined();
    expect(screen.getByText("Warning Description")).toBeDefined();
    expect(screen.getByText("Action")).toBeDefined();
  });

  it("handles close event", () => {
    const handleClose = vi.fn();
    render(
      <AlertBanner
        type="info"
        message="Info Message"
        closable
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole("button", { name: "close" });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
