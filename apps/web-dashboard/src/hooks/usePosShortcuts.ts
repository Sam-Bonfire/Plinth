import { useEffect } from "react";

export type ShortcutAction = "discount" | "hold" | "pay" | "search" | "clear";

export interface ShortcutBinding {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export const defaultBindings: Record<ShortcutAction, ShortcutBinding> = {
  discount: { key: "F2" },
  hold: { key: "F4" },
  pay: { key: "F9" },
  search: { key: "f", ctrlKey: true },
  clear: { key: "Escape" },
};

export const matchShortcut = (event: KeyboardEvent, bindings: Record<ShortcutAction, ShortcutBinding>): ShortcutAction | null => {
  for (const action in bindings) {
    const act = action as ShortcutAction;
    const binding = bindings[act];
    if (
      event.key.toLowerCase() === binding.key.toLowerCase() &&
      !!event.ctrlKey === !!binding.ctrlKey &&
      !!event.altKey === !!binding.altKey &&
      !!event.shiftKey === !!binding.shiftKey &&
      !!event.metaKey === !!binding.metaKey
    ) {
      return act;
    }
  }
  return null;
};

export const usePosShortcuts = (callbacks: Partial<Record<ShortcutAction, () => void>>, bindings = defaultBindings): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Ignore keystrokes inside text inputs
      if (event.target instanceof HTMLElement) {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable) {
          return;
        }
      }

      const action = matchShortcut(event, bindings);
      if (action !== null) {
        const callback = callbacks[action];
        if (callback !== undefined) {
          event.preventDefault();
          callback();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [callbacks, bindings]);
};
