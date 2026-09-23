import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { TurnoverReport, computeTurnoverStats } from "./TurnoverReport";

describe("TurnoverReport", () => {
  describe("computeTurnoverStats", () => {
    it("should compute average turnover correctly and exclude still-seated sessions", () => {
      const sessions = [
        { table: "T-1", seatedAt_min: 0, clearedAt_min: 30, covers: 2 }, // 30 mins
        { table: "T-1", seatedAt_min: 60, clearedAt_min: 120, covers: 2 }, // 60 mins -> avg 45
        { table: "T-2", seatedAt_min: 0, clearedAt_min: null, covers: 4 }, // still seated
        { table: "T-3", seatedAt_min: 10, clearedAt_min: 50, covers: 4 }, // 40 mins
      ];

      const stats = computeTurnoverStats(sessions, 10);

      expect(stats.perTableAvgTurnover["T-1"]).toBe(45);
      expect(stats.perTableAvgTurnover["T-3"]).toBe(40);
      expect(stats.perTableAvgTurnover["T-2"]).toBeUndefined();

      // Occupancy: T-2 is active. 1 / 10 = 10%
      expect(stats.overallOccupancyPercent).toBe(10);
    });

    it("should handle empty sessions", () => {
      const stats = computeTurnoverStats([], 10);
      expect(stats.perTableAvgTurnover).toEqual({});
      expect(stats.overallOccupancyPercent).toBe(0);
    });
  });

  describe("component rendering", () => {
    it("should render stats and table", () => {
      const sessions = [
        { table: "T-1", seatedAt_min: 0, clearedAt_min: 30, covers: 2 },
        { table: "T-2", seatedAt_min: 0, clearedAt_min: null, covers: 4 },
      ];

      render(<TurnoverReport sessions={sessions} totalTablesCount={4} />);

      // Occupancy: 1 / 4 = 25%
      expect(screen.getByText("Occupancy Rate")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();

      // Table T-1 should be in the table
      expect(screen.getByText("T-1")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
    });
  });
});
