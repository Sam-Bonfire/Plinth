import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultBindings, matchShortcut, usePosShortcuts } from "../usePosShortcuts.js";

describe("usePosShortcuts - matchShortcut", () => {
  it("matches F2 to discount", () => {
    const event = new KeyboardEvent("keydown", { key: "F2" });
    expect(matchShortcut(event, defaultBindings)).toBe("discount");
  });

  it("matches F4 to hold", () => {
    const event = new KeyboardEvent("keydown", { key: "F4" });
    expect(matchShortcut(event, defaultBindings)).toBe("hold");
  });

  it("matches F9 to pay", () => {
    const event = new KeyboardEvent("keydown", { key: "F9" });
    expect(matchShortcut(event, defaultBindings)).toBe("pay");
  });

  it("matches Ctrl+F to search", () => {
    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true });
    expect(matchShortcut(event, defaultBindings)).toBe("search");
  });

  it("matches Escape to clear", () => {
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    expect(matchShortcut(event, defaultBindings)).toBe("clear");
  });

  it("returns null for unmatched shortcuts", () => {
    const event = new KeyboardEvent("keydown", { key: "a" });
    expect(matchShortcut(event, defaultBindings)).toBeNull();
  });

  it("respects modifier keys (e.g. search should fail without ctrl)", () => {
    const event = new KeyboardEvent("keydown", { key: "f" });
    expect(matchShortcut(event, defaultBindings)).toBeNull();
  });
});

describe("usePosShortcuts - hook", () => {
  it("registers and cleans up event listeners", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => usePosShortcuts({}));

    expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeEventListenerSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("triggers callback on matched shortcut and prevents default", () => {
    const discountMock = vi.fn();
    renderHook(() => usePosShortcuts({ discount: discountMock }));

    const event = new KeyboardEvent("keydown", { key: "F2", cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(discountMock).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores keystrokes originating from inputs", () => {
    const payMock = vi.fn();
    renderHook(() => usePosShortcuts({ pay: payMock }));

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", { key: "F9", bubbles: true });
    input.dispatchEvent(event);

    expect(payMock).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores keystrokes originating from textareas", () => {
    const payMock = vi.fn();
    renderHook(() => usePosShortcuts({ pay: payMock }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const event = new KeyboardEvent("keydown", { key: "F9", bubbles: true });
    textarea.dispatchEvent(event);

    expect(payMock).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("ignores keystrokes originating from contenteditable elements", () => {
    const payMock = vi.fn();
    renderHook(() => usePosShortcuts({ pay: payMock }));

    const div = document.createElement("div");
    // Explicitly mock the getter since jsdom doesn't fully implement contentEditable property propagation
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    document.body.appendChild(div);

    const event = new KeyboardEvent("keydown", { key: "F9", bubbles: true });
    div.dispatchEvent(event);

    expect(payMock).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });
});
