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
  if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
    try {
      return localStorage.getItem(key);
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
  if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage write quota or access errors in sandbox
    }
  }
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
    toast: Omit<ToastItem, "id" | "remainingMs" | "isPaused" | "createdAt"> & {
      id?: string;
      durationMs?: number;
    },
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
