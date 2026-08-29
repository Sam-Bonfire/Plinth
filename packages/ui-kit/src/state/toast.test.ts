import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ToastManager,
  getSafeStorageItem,
  setSafeStorageItem,
  isOnlineSafe,
} from "./toast.js";

describe("Toast State Engine & Storage Runtime Guards", () => {
  let toastManager: ToastManager;

  beforeEach(() => {
    toastManager = new ToastManager();
  });

  afterEach(() => {
    toastManager.destroy();
    vi.restoreAllMocks();
  });

  it("adds toast and notifies subscribers with calculated countdown duration", () => {
    const subscriber = vi.fn();
    const unsubscribe = toastManager.subscribe(subscriber);

    const toastId = toastManager.add({
      type: "success",
      title: "Order Submitted",
      message: "Order #1098 created successfully",
      durationMs: 3000,
    });

    expect(toastId).toBeDefined();
    const toasts = toastManager.getToasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].title).toBe("Order Submitted");
    expect(toasts[0].remainingMs).toBe(3000);
    expect(toasts[0].isPaused).toBe(false);

    unsubscribe();
  });

  it("decrements remainingMs on tick and removes expired toasts", () => {
    toastManager.add({
      type: "info",
      title: "Syncing mutations",
      durationMs: 300,
    });

    expect(toastManager.getToasts().length).toBe(1);

    // 1st tick (-100ms -> 200ms)
    toastManager.tick();
    expect(toastManager.getToasts()[0].remainingMs).toBe(200);

    // 2nd tick (-100ms -> 100ms)
    toastManager.tick();
    expect(toastManager.getToasts()[0].remainingMs).toBe(100);

    // 3rd tick (-100ms -> 0ms -> removed)
    toastManager.tick();
    expect(toastManager.getToasts().length).toBe(0);
  });

  it("pauses countdown when paused and resumes when resumed", () => {
    const id = toastManager.add({
      type: "warning",
      title: "Low Inventory",
      durationMs: 500,
    });

    toastManager.pause(id);
    expect(toastManager.getToasts()[0].isPaused).toBe(true);

    // Tick while paused should not decrement remainingMs
    toastManager.tick();
    expect(toastManager.getToasts()[0].remainingMs).toBe(500);

    toastManager.resume(id);
    expect(toastManager.getToasts()[0].isPaused).toBe(false);

    // Tick while resumed should decrement
    toastManager.tick();
    expect(toastManager.getToasts()[0].remainingMs).toBe(400);
  });

  it("dismisses toast manually immediately", () => {
    const id = toastManager.add({
      type: "error",
      title: "Network Offline",
    });

    expect(toastManager.getToasts().length).toBe(1);
    toastManager.dismiss(id);
    expect(toastManager.getToasts().length).toBe(0);
  });

  it("safely interacts with storage without throwing in headless environments", () => {
    setSafeStorageItem("plinth_test_key", "test_value");
    expect(getSafeStorageItem("plinth_test_key")).toBe("test_value");

    expect(isOnlineSafe()).toBe(true);
  });
});
