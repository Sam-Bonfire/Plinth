import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LockScreen } from "./LockScreen.js";

describe("LockScreen", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof LockScreen>> = {}) => {
    return render(
      <App>
        <LockScreen open={true} onUnlock={vi.fn().mockResolvedValue(undefined)} staffName="Test Staff" {...props} />
      </App>
    );
  };

  it("does not render when open is false", () => {
    renderComponent({ open: false });
    expect(screen.queryByText(/Locked: Test Staff/)).not.toBeInTheDocument();
  });

  it("renders overlay with store name, time, and form when open is true", () => {
    renderComponent({ storeName: "My Store" });
    expect(screen.getByText("My Store")).toBeInTheDocument();
    expect(screen.getByText(/Locked: Test Staff/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••")).toBeInTheDocument();
  });

  it("calls onUnlock with pin when form is submitted", { timeout: 30000 }, async () => {
    // Use real timers for userEvent compatibility which relies on accurate delays
    vi.useRealTimers();
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(undefined);
    renderComponent({ onUnlock });

    await user.type(screen.getByPlaceholderText("••••"), "1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(onUnlock).toHaveBeenCalledWith("1234");
    });
  });

  it("displays error message if onUnlock fails", { timeout: 30000 }, async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockRejectedValue(new Error("Invalid"));
    renderComponent({ onUnlock });

    await user.type(screen.getByPlaceholderText("••••"), "9999");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(onUnlock).toHaveBeenCalledWith("9999");
      expect(screen.getByText("Invalid PIN")).toBeInTheDocument();
    });
  });
});
