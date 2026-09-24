import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { decodeBurst, useBarcodeScanner, type KeyTime } from "./useBarcodeScanner.js";

describe("decodeBurst", () => {
  it("returns null if less than 7 events (6 chars + 1 Enter)", () => {
    const events: KeyTime[] = [
      { key: "A", t: 0 },
      { key: "B", t: 10 },
      { key: "C", t: 20 },
      { key: "D", t: 30 },
      { key: "Enter", t: 40 },
    ];
    expect(decodeBurst(events)).toBeNull();
  });

  it("returns null if last key is not Enter", () => {
    const events: KeyTime[] = [
      { key: "A", t: 0 },
      { key: "B", t: 10 },
      { key: "C", t: 20 },
      { key: "D", t: 30 },
      { key: "E", t: 40 },
      { key: "F", t: 50 },
      { key: "G", t: 60 },
    ];
    expect(decodeBurst(events)).toBeNull();
  });

  it("returns null if burst duration is > 80ms", () => {
    const events: KeyTime[] = [
      { key: "A", t: 0 },
      { key: "B", t: 10 },
      { key: "C", t: 20 },
      { key: "D", t: 30 },
      { key: "E", t: 40 },
      { key: "F", t: 50 },
      { key: "Enter", t: 90 },
    ];
    expect(decodeBurst(events)).toBeNull();
  });

  it("returns characters joined for a valid burst", () => {
    const events: KeyTime[] = [
      { key: "1", t: 0 },
      { key: "2", t: 10 },
      { key: "3", t: 20 },
      { key: "4", t: 30 },
      { key: "5", t: 40 },
      { key: "6", t: 50 },
      { key: "Enter", t: 60 },
    ];
    expect(decodeBurst(events)).toBe("123456");
  });
});

describe("useBarcodeScanner", () => {
  it("ignores keydown events inside input or textarea", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.keyDown(window, { key: "5" });
    fireEvent.keyDown(window, { key: "6" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onScan).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("detects a valid burst when focused on body", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));

    document.body.focus();
    const now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.keyDown(window, { key: "4" });
    fireEvent.keyDown(window, { key: "5" });
    fireEvent.keyDown(window, { key: "6" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onScan).toHaveBeenCalledWith("123456");
    vi.restoreAllMocks();
  });
});
