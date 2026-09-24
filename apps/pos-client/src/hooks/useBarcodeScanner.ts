import { useEffect, useRef } from "react";

export interface KeyTime {
  key: string;
  t: number;
}

export function decodeBurst(events: KeyTime[]): string | null {
  if (events.length < 7) return null; // Minimum 6 chars + 1 Enter = 7 events
  const last = events[events.length - 1];
  if (last?.key !== "Enter") return null;

  const first = events[0];
  if (!first || !last) return null;

  if (last.t - first.t > 80) return null;

  const chars = events.slice(0, -1).map((e) => e.key).join("");
  return chars;
}

export function useBarcodeScanner(onScan: (code: string) => void): void {
  const eventsRef = useRef<KeyTime[]>([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tag = activeElement.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") {
          return;
        }
      }

      const now = Date.now();

      // Filter events to only those within the last 100ms so the array doesn't grow indefinitely
      eventsRef.current = eventsRef.current.filter((ev) => now - ev.t <= 100);

      // Only care about single character keys or "Enter"
      if (e.key.length === 1 || e.key === "Enter") {
        eventsRef.current.push({ key: e.key, t: now });

        if (e.key === "Enter") {
          const code = decodeBurst(eventsRef.current);
          if (code) {
            onScan(code);
            eventsRef.current = []; // Reset after successful scan
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onScan]);
}
