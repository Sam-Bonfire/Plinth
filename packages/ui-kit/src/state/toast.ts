export type ToastType = "success" | "info" | "warning" | "error";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs: number;
  remainingMs: number;
  isPaused: boolean;
  createdAt: number;
}

export type ToastListener = (toasts: ToastItem[]) => void;

/**
 * Safely accesses localStorage in browser, Electron, Tauri, or SSR Node environments.
 */
export function getSafeStorageItem(key: string): string | null {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Safely sets localStorage item in browser, Electron, Tauri, or SSR Node environments.
 */
export function setSafeStorageItem(key: string, value: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // Ignore storage write quota or access errors in sandbox
    }
  }
}

const fallbackMem = new Map<string, string>();

function getStorage(): Storage | null {
  try {
    // Prefer globalThis.localStorage, fallback to window.localStorage for happy-dom
    const maybeGlobal = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (maybeGlobal && typeof maybeGlobal.getItem === "function") {
      return maybeGlobal;
    }
    const maybeWindow =
      typeof window !== "undefined"
        ? (window as unknown as { localStorage?: Storage }).localStorage
        : undefined;
    if (maybeWindow && typeof maybeWindow.getItem === "function") {
      return maybeWindow;
    }
  } catch {
    // fall through to in-memory fallback
  }
  // In-memory fallback ensures headless/test environments still satisfy storage contract
  return {
    getItem: (key: string): string | null => fallbackMem.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      fallbackMem.set(key, value);
    },
    removeItem: (key: string): void => {
      fallbackMem.delete(key);
    },
    clear: (): void => {
      fallbackMem.clear();
    },
    key: (index: number): string | null => Array.from(fallbackMem.keys())[index] ?? null,
    get length(): number {
      return fallbackMem.size;
    },
  } as Storage;
}

/**
 * Checks if runtime is online safely without assuming browser DOM exists.
 */
export function isOnlineSafe(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

/**
 * Toast timer countdown state engine with pause on hover and cancel capabilities.
 */
export class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly tickIntervalMs = 100;

  constructor() {
    this.startTicker();
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.getToasts());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  public add(
    toast: Omit<ToastItem, "id" | "remainingMs" | "isPaused" | "createdAt" | "durationMs"> & {
      id?: string;
      durationMs?: number;
    } & Pick<ToastItem, "type" | "title"> & Partial<Pick<ToastItem, "message">>,
  ): string {
    const duration = toast.durationMs ?? 4000;
    const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = {
      ...toast,
      id,
      durationMs: duration,
      remainingMs: duration,
      isPaused: false,
      createdAt: Date.now(),
    };

    this.toasts.push(newToast);
    this.notify();
    return id;
  }

  public dismiss(id: string): void {
    const prevLen = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length !== prevLen) {
      this.notify();
    }
  }

  public pause(id: string): void {
    const toast = this.toasts.find((t) => t.id === id);
    if (toast && !toast.isPaused) {
      toast.isPaused = true;
      this.notify();
    }
  }

  public resume(id: string): void {
    const toast = this.toasts.find((t) => t.id === id);
    if (toast && toast.isPaused) {
      toast.isPaused = false;
      this.notify();
    }
  }

  public clear(): void {
    this.toasts = [];
    this.notify();
  }

  public destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.listeners.clear();
    this.toasts = [];
  }

  private startTicker(): void {
    if (typeof setInterval !== "undefined" && this.intervalId === null) {
      this.intervalId = setInterval(() => this.tick(), this.tickIntervalMs);
    }
  }

  public tick(): void {
    if (this.toasts.length === 0) {
      return;
    }

    let changed = false;
    const remainingToasts: ToastItem[] = [];

    for (const toast of this.toasts) {
      if (toast.isPaused) {
        remainingToasts.push(toast);
        continue;
      }

      toast.remainingMs -= this.tickIntervalMs;
      if (toast.remainingMs > 0) {
        remainingToasts.push(toast);
      } else {
        changed = true;
      }
    }

    if (changed || remainingToasts.length !== this.toasts.length) {
      this.toasts = remainingToasts;
      this.notify();
    }
  }

  private notify(): void {
    const current = this.getToasts();
    for (const listener of this.listeners) {
      listener(current);
    }
  }
}
