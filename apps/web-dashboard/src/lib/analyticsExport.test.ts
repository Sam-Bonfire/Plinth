import { describe, expect, it } from "vitest";
import { buildAnalyticsCsv, type CsvSection } from "./analyticsExport.js";

describe("buildAnalyticsCsv", () => {
  it("generates simple csv", () => {
    const sections: CsvSection[] = [
      {
        title: "Test Section",
        headers: ["Col1", "Col2"],
        rows: [
          ["Val1", "Val2"],
          [10, 20],
        ],
      },
    ];

    const result = buildAnalyticsCsv(sections);
    const expected = [
      "Test Section",
      "Col1,Col2",
      "Val1,Val2",
      "10,20"
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("escapes values with commas", () => {
    const sections: CsvSection[] = [
      {
        title: "Test Section, With Comma",
        headers: ["Col1", "Col2"],
        rows: [
          ["Val1, Extra", "Val2"],
        ],
      },
    ];

    const result = buildAnalyticsCsv(sections);
    const expected = [
      '"Test Section, With Comma"',
      "Col1,Col2",
      '"Val1, Extra",Val2'
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("escapes values with quotes", () => {
    const sections: CsvSection[] = [
      {
        title: 'Test Section "Quote"',
        headers: ["Col1"],
        rows: [
          ['Val1 "Extra"'],
        ],
      },
    ];

    const result = buildAnalyticsCsv(sections);
    const expected = [
      '"Test Section ""Quote"""',
      "Col1",
      '"Val1 ""Extra"""'
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("escapes values with newlines", () => {
    const sections: CsvSection[] = [
      {
        title: "Test Section",
        headers: ["Col1"],
        rows: [
          ["Val1\nExtra"],
        ],
      },
    ];

    const result = buildAnalyticsCsv(sections);
    const expected = [
      "Test Section",
      "Col1",
      '"Val1\nExtra"'
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("handles multiple sections", () => {
    const sections: CsvSection[] = [
      {
        title: "Section 1",
        headers: ["A"],
        rows: [["1"]],
      },
      {
        title: "Section 2",
        headers: ["B"],
        rows: [["2"]],
      },
    ];

    const result = buildAnalyticsCsv(sections);
    const expected = [
      "Section 1",
      "A",
      "1",
      "",
      "Section 2",
      "B",
      "2"
    ].join("\n");

    expect(result).toBe(expected);
  });
});
