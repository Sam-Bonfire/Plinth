import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "plinth-pos-sound-enabled";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

// For testing purposes
export function _resetAudioContextForTest(): void {
  audioCtx = null;
}

export function isSoundEnabled(): boolean {
  const val = localStorage.getItem(STORAGE_KEY);
  return val !== "false"; // Default to true if not set
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function playTone(kind: "success" | "error" | "tap"): void {
  if (!isSoundEnabled()) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (kind) {
      case "success":
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      case "error":
        osc.type = "square";
        osc.frequency.setValueAtTime(150, now);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case "tap":
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
    }
  } catch (e) {
    // Ignore audio context creation/playback errors (e.g. if unsupported or no user interaction yet)
    console.error("Failed to play tone", e);
  }
}

export function useSoundEnabled(): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState<boolean>(isSoundEnabled());

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === STORAGE_KEY) {
        setEnabled(e.newValue !== "false");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const toggle = useCallback((): void => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  }, [enabled]);

  return { enabled, toggle };
}
