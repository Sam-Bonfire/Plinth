import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { _resetAudioContextForTest, isSoundEnabled, playTone, setSoundEnabled, useSoundEnabled } from "./sounds.js";

interface MockAudioContextState {
  state: string;
  resume: MockInstance;
  createOscillator: MockInstance;
  createGain: MockInstance;
  destination: Record<string, unknown>;
  currentTime: number;
}

describe("sounds", () => {
  let mockCtx: MockAudioContextState;

  beforeEach(() => {
    localStorage.clear();
    mockCtx = {
      state: "running",
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue({
        connect: vi.fn(),
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
        type: "sine",
      }),
      createGain: vi.fn().mockReturnValue({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      }),
      destination: {},
      currentTime: 100,
    };

    const MockAudioContext = vi.fn().mockImplementation(() => mockCtx);
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("webkitAudioContext", MockAudioContext);

    _resetAudioContextForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is enabled by default", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("can be disabled and enabled", () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("does not play tone if disabled", () => {
    setSoundEnabled(false);
    playTone("success");
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });

  it("plays tone if enabled", () => {
    setSoundEnabled(true);
    playTone("success");
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  it("resumes context if suspended", () => {
    mockCtx.state = "suspended";
    playTone("tap");
    expect(mockCtx.resume).toHaveBeenCalled();
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it("useSoundEnabled hook tracks and toggles state", () => {
    setSoundEnabled(true);
    const { result } = renderHook(() => useSoundEnabled());

    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.enabled).toBe(false);
    expect(isSoundEnabled()).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.enabled).toBe(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("handles storage events across tabs", () => {
    setSoundEnabled(true);
    const { result } = renderHook(() => useSoundEnabled());
    expect(result.current.enabled).toBe(true);

    act(() => {
      const event = new StorageEvent("storage", {
        key: "plinth-pos-sound-enabled",
        newValue: "false",
      });
      window.dispatchEvent(event);
    });

    expect(result.current.enabled).toBe(false);
  });

  it("catches errors silently if AudioContext throws", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCtx.createOscillator.mockImplementationOnce(() => {
      throw new Error("mock error");
    });

    expect(() => playTone("success")).not.toThrow();
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
