import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VarianceChart, toVarianceRows, varianceTotal } from "./VarianceChart.js";

describe("VarianceChart helpers", () => {
  it("expands entries into grouped rows", () => {
    const rows = toVarianceRows([{ label: "Flour", theoretical: 100, actual: 122 }]);
    expect(rows).toEqual([
      { label: "Flour", series: "Theoretical", value: 100 },
      { label: "Flour", series: "Actual", value: 122 },
    ]);
  });

  it("sums signed variance", () => {
    expect(
      varianceTotal([
        { label: "Flour", theoretical: 100, actual: 122 },
        { label: "Sugar", theoretical: 50, actual: 40 },
      ]),
    ).toBe(12);
  });
});

describe("VarianceChart", () => {
  it("renders an empty state without entries", () => {
    render(<VarianceChart entries={[]} title="Usage variance" />);
    expect(screen.getByText("Usage variance")).toBeDefined();
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
  });
});
