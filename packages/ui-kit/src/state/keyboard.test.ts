import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeyboardShortcutManager, isInputFocused, formatKeyChord } from "./keyboard.js";

describe("Keyboard State Engine & Input Guard", () => {
  let manager: KeyboardShortcutManager;

  beforeEach(() => {
    manager = new KeyboardShortcutManager();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    manager.clear();
    document.body.innerHTML = "";
  });

  it("formats key chords with modifier labels accurately", () => {
    expect(formatKeyChord({ key: "k", ctrlKey: true })).toBe("Ctrl+K");
    expect(formatKeyChord({ key: "n", altKey: true })).toBe("Alt+N");
    expect(formatKeyChord({ key: "enter", ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+ENTER");
  });

  it("detects when an input element is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    expect(isInputFocused(input)).toBe(true);

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    expect(isInputFocused(textarea)).toBe(true);

    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");
    document.body.appendChild(contentEditable);
    expect(isInputFocused(contentEditable)).toBe(true);

    const button = document.createElement("button");
    document.body.appendChild(button);
    expect(isInputFocused(button)).toBe(false);
  });

  it("triggers registered shortcut handler on matching key combination", () => {
    const handler = vi.fn();
    manager.register({
      id: "quick-search",
      key: "k",
      ctrlKey: true,
      handler,
    });

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    const handled = manager.handleKeyDown(event);
    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("suppresses shortcuts when focus is inside an input without allowInInput", () => {
    const handler = vi.fn();
    manager.register({
      id: "quick-search",
      key: "k",
      ctrlKey: true,
      allowInInput: false,
      handler,
    });

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", { value: input, writable: false });

    const handled = manager.handleKeyDown(event);
    expect(handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows shortcuts when allowInInput is true even if focused in an input", () => {
    const handler = vi.fn();
    manager.register({
      id: "escape-modal",
      key: "Escape",
      allowInInput: true,
      handler,
    });

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", { value: input, writable: false });

    const handled = manager.handleKeyDown(event);
    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unregisters shortcuts cleanly", () => {
    const handler = vi.fn();
    const unregister = manager.register({
      id: "test-shortcut",
      key: "n",
      altKey: true,
      handler,
    });

    unregister();

    const event = new KeyboardEvent("keydown", {
      key: "n",
      altKey: true,
    });

    const handled = manager.handleKeyDown(event);
    expect(handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
