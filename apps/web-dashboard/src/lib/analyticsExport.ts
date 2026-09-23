export interface CsvSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAnalyticsCsv(sections: CsvSection[]): string {
  const lines: string[] = [];

  for (const section of sections) {
    // Add title line
    lines.push(escapeCsvValue(section.title));

    // Add headers
    if (section.headers.length > 0) {
      lines.push(section.headers.map(escapeCsvValue).join(","));
    }

    // Add rows
    for (const row of section.rows) {
      lines.push(row.map(escapeCsvValue).join(","));
    }

    // Add a blank line between sections
    lines.push("");
  }

  // Remove the trailing blank line if there's any sections
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}
