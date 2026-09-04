import { render, screen, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiveTimerDisplay } from "./LiveTimerDisplay.js";

describe("LiveTimerDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with 00:00 for current time", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LiveTimerDisplay startTime={now} />);

    expect(screen.getByText("00:00")).toBeDefined();
    const timeEl = screen.getByText("00:00").closest("time");
    expect(timeEl?.className).toContain("plinth-live-timer-normal");
  });

  it("ticks and updates time automatically", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LiveTimerDisplay startTime={now} />);

    expect(screen.getByText("00:00")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("00:05")).toBeDefined();
  });

  it("pauses when isPaused is true", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { rerender } = render(<LiveTimerDisplay startTime={now} isPaused={false} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("00:02")).toBeDefined();

    rerender(<LiveTimerDisplay startTime={now} isPaused={true} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should stay at 00:02 because it was paused
    expect(screen.getByText("00:02")).toBeDefined();
  });

  it("shifts to warning color at warningThresholdMinutes", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LiveTimerDisplay startTime={now} warningThresholdMinutes={10} />);

    act(() => {
      // Advance by 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(screen.getByText("10:00")).toBeDefined();
    const timeEl = screen.getByText("10:00").closest("time");
    expect(timeEl?.className).toContain("plinth-live-timer-warning");
    expect(timeEl?.className).not.toContain("plinth-live-timer-normal");
  });

  it("shifts to critical color at criticalThresholdMinutes", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LiveTimerDisplay startTime={now} warningThresholdMinutes={10} criticalThresholdMinutes={15} />);

    act(() => {
      // Advance by 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    expect(screen.getByText("15:00")).toBeDefined();
    const timeEl = screen.getByText("15:00").closest("time");
    expect(timeEl?.className).toContain("plinth-live-timer-critical");
    expect(timeEl?.className).not.toContain("plinth-live-timer-warning");
  });

  it("handles future dates gracefully by showing 00:00", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const future = now + 60000; // 1 minute in future

    render(<LiveTimerDisplay startTime={future} />);

    expect(screen.getByText("00:00")).toBeDefined();
  });

  it("handles invalid dates gracefully", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<LiveTimerDisplay startTime="invalid-date" />);

    expect(screen.getByText("00:00")).toBeDefined();
    const timeEl = screen.getByText("00:00").closest("time");
    expect(timeEl?.className).toContain("plinth-live-timer-normal");
  });

  it("formats time correctly based on format prop", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { rerender } = render(<LiveTimerDisplay startTime={now} format="hh:mm:ss" />);

    act(() => {
      // Advance by 65 minutes (1h 5m)
      vi.advanceTimersByTime(65 * 60 * 1000);
    });

    expect(screen.getByText("01:05:00")).toBeDefined();

    rerender(<LiveTimerDisplay startTime={now} format="mm:ss" />);
    expect(screen.getByText("65:00")).toBeDefined();
  });

  it("cleans up interval on unmount", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { unmount } = render(<LiveTimerDisplay startTime={now} />);

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
