import { useEffect } from "react";

export type TickSla = "OnTime" | "Warning" | "Late";

export interface Tickable {
  elapsedSeconds: number;
  sla: TickSla;
}

export const WARN_SECONDS = 240;
export const LATE_SECONDS = 480;

export function slaFor(elapsedSeconds: number): TickSla {
  if (elapsedSeconds >= LATE_SECONDS) {
    return "Late";
  }
  if (elapsedSeconds >= WARN_SECONDS) {
    return "Warning";
  }
  return "OnTime";
}

export function tickTickets<T extends Tickable>(tickets: T[]): T[] {
  return tickets.map((t) => {
    const elapsedSeconds = t.elapsedSeconds + 1;
    return { ...t, elapsedSeconds, sla: slaFor(elapsedSeconds) };
  });
}

/// Advances KDS elapsed timers once per second. The updater receives the
/// pure tick transform so boards stay in sync without drifting intervals.
export function useKdsTick<T extends Tickable>(apply: (step: (prev: T[]) => T[]) => void): void {
  useEffect(() => {
    const timer = setInterval(() => {
      apply((prev) => tickTickets(prev));
    }, 1000);
    return (): void => {
      clearInterval(timer);
    };
  }, [apply]);
}
