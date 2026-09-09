import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KDSBumpButton } from "./KDSBumpButton.js";

describe("KDSBumpButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders bump label and fires onBump with done state", () => {
    vi.useFakeTimers();
    const onBump = vi.fn();
    render(<KDSBumpButton onBump={onBump} />);
    expect(screen.getByText("BUMP")).toBeDefined();
    fireEvent.click(screen.getByTestId("kds-bump-button"));
    expect(onBump).toHaveBeenCalledTimes(1);
    expect(screen.getByText("BUMPED ✓")).toBeDefined();
  });

  it("reverts to bump label after the done window", () => {
    vi.useFakeTimers();
    render(<KDSBumpButton onBump={vi.fn()} />);
    fireEvent.click(screen.getByTestId("kds-bump-button"));
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("BUMP")).toBeDefined();
  });

  it("ignores double clicks inside the done window", () => {
    vi.useFakeTimers();
    const onBump = vi.fn();
    render(<KDSBumpButton onBump={onBump} />);
    const button = screen.getByTestId("kds-bump-button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onBump).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const onBump = vi.fn();
    render(<KDSBumpButton onBump={onBump} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(onBump).not.toHaveBeenCalled();
  });
});
