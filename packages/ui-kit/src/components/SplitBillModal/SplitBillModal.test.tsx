import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SplitBillModal, splitEvenly } from "./SplitBillModal.js";

describe("splitEvenly", () => {
  it("splits exactly with remainder on first shares", () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("handles even splits and zero total", () => {
    expect(splitEvenly(200, 4)).toEqual([50, 50, 50, 50]);
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
  });

  it("sums exactly for negative totals and degenerate parts", () => {
    const neg = splitEvenly(-100, 3);
    expect(neg.reduce((a, b) => a + b, 0)).toBe(-100);
    expect(splitEvenly(100, 0)).toEqual([100]);
    expect(splitEvenly(100, NaN)).toEqual([]);
  });
});

describe("SplitBillModal", () => {
  it("renders shares summing to the total", () => {
    render(<SplitBillModal open totalMinor={10000} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("split-bill-modal")).toBeDefined();
    expect(screen.getByText("₹100.00")).toBeDefined();
    expect(screen.getByTestId("split-share-0")).toBeDefined();
    expect(screen.getByTestId("split-share-1")).toBeDefined();
  });

  it("confirms with the computed splits", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<SplitBillModal open totalMinor={100} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("split-confirm"));
    expect(onConfirm).toHaveBeenCalledWith([50, 50]);
    expect(onClose).toHaveBeenCalled();
  });

  it("clamps typed parts to twelve shares", () => {
    render(<SplitBillModal open totalMinor={1200} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const parts = screen.getByTestId("split-parts");
    fireEvent.change(parts, { target: { value: "99" } });
    fireEvent.blur(parts);
    expect(screen.getByTestId("split-share-11")).toBeDefined();
    expect(screen.queryByTestId("split-share-12")).toBeNull();
  });
});
