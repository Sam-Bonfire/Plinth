export interface KeyboardShortcut {
  id: string;
  key: string; // e.g. "k", "n", "Escape", "Enter"
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description?: string;
  allowInInput?: boolean;
  handler: (event: KeyboardEvent) => void;
}

/**
 * Determines whether keyboard shortcuts should be suppressed because focus is currently
 * inside an interactive text input element.
 */
export function isInputFocused(target?: EventTarget | null): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const el = (target as HTMLElement) ?? document.activeElement;
  if (!el) {
    return false;
  }

  const tagName = el.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (
    el.isContentEditable ||
    el.getAttribute?.("contenteditable") === "true" ||
    (el as unknown as { contentEditable?: string }).contentEditable === "true"
  ) {
    return true;
  }

  const role = el.getAttribute?.("role");
  if (role === "textbox" || role === "searchbox") {
    return true;
  }

  return false;
}

export function formatKeyChord(shortcut: Omit<KeyboardShortcut, "handler" | "id">): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push("Ctrl");
  }
  if (shortcut.altKey) {
    parts.push("Alt");
  }
  if (shortcut.shiftKey) {
    parts.push("Shift");
  }
  parts.push(shortcut.key.toUpperCase());
  return parts.join("+");
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isListening = false;
  private boundHandler: (event: KeyboardEvent) => void;

  constructor() {
    this.boundHandler = this.handleKeyDown.bind(this);
  }

  public register(shortcut: KeyboardShortcut): () => void {
    this.shortcuts.set(shortcut.id, shortcut);
    if (!this.isListening && typeof window !== "undefined") {
      this.startListening();
    }
    return () => this.unregister(shortcut.id);
  }

  public unregister(id: string): void {
    this.shortcuts.delete(id);
    if (this.shortcuts.size === 0 && this.isListening) {
      this.stopListening();
    }
  }

  public clear(): void {
    this.shortcuts.clear();
    this.stopListening();
  }

  public startListening(): void {
    if (typeof window !== "undefined" && !this.isListening) {
      window.addEventListener("keydown", this.boundHandler);
      this.isListening = true;
    }
  }

  public stopListening(): void {
    if (typeof window !== "undefined" && this.isListening) {
      window.removeEventListener("keydown", this.boundHandler);
      this.isListening = false;
    }
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    const inputActive = isInputFocused(event.target);

    for (const shortcut of this.shortcuts.values()) {
      if (inputActive && !shortcut.allowInInput) {
        continue;
      }

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = Boolean(shortcut.ctrlKey || shortcut.metaKey) === (event.ctrlKey || event.metaKey);
      const altMatch = Boolean(shortcut.altKey) === event.altKey;
      const shiftMatch = Boolean(shortcut.shiftKey) === event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        shortcut.handler(event);
        return true;
      }
    }

    return false;
  }
}
