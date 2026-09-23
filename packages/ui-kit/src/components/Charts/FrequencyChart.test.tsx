import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FrequencyChart, toFrequencyRows } from "./FrequencyChart.js";

describe("FrequencyChart helpers", () => {
  it("groups entries into frequency buckets", () => {
    const rows = toFrequencyRows([
      { visits: 1 },
      { visits: 2 },
      { visits: 5 },
      { visits: 6 },
      { visits: 12 },
      { visits: 13 },
      { visits: 20 },
    ]);
    expect(rows).toEqual([
      { bucket: "1", count: 1 },
      { bucket: "2-5", count: 2 },
      { bucket: "6-12", count: 2 },
      { bucket: "13+", count: 2 },
    ]);
  });

  it("returns empty array for empty entries", () => {
    expect(toFrequencyRows([])).toEqual([]);
  });
});

describe("FrequencyChart", () => {
  it("renders an empty state without entries", () => {
    render(<FrequencyChart entries={[]} title="Visit frequency" />);
    expect(screen.getByText("Visit frequency")).toBeDefined();
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
  });
});
