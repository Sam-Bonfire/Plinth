import { describe, it, expect } from "vitest";
import { slaFor, tickTickets, WARN_SECONDS, LATE_SECONDS } from "./useKdsTick.js";

describe("useKdsTick helpers", () => {
  it("escalates SLA at warning and late thresholds", () => {
    expect(slaFor(0)).toBe("OnTime");
    expect(slaFor(WARN_SECONDS - 1)).toBe("OnTime");
    expect(slaFor(WARN_SECONDS)).toBe("Warning");
    expect(slaFor(LATE_SECONDS - 1)).toBe("Warning");
    expect(slaFor(LATE_SECONDS)).toBe("Late");
  });

  it("advances every ticket by one second", () => {
    const next = tickTickets([
      { elapsedSeconds: 10, sla: "OnTime" as const },
      { elapsedSeconds: WARN_SECONDS - 1, sla: "OnTime" as const },
    ]);
    expect(next[0]?.elapsedSeconds).toBe(11);
    expect(next[0]?.sla).toBe("OnTime");
    expect(next[1]?.elapsedSeconds).toBe(WARN_SECONDS);
    expect(next[1]?.sla).toBe("Warning");
  });

  it("leaves late tickets late", () => {
    const next = tickTickets([{ elapsedSeconds: LATE_SECONDS + 30, sla: "Late" as const }]);
    expect(next[0]?.sla).toBe("Late");
  });
});
