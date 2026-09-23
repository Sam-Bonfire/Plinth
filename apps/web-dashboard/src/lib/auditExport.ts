export interface CsvAuditRow {
  time: string;
  actor: string;
  role: string;
  action: string;
  kind: string;
  target: string;
  value: string;
  approvedBy: string;
}

export function buildAuditCsv(rows: CsvAuditRow[]): string {
  const headers = ["time", "actor", "role", "action", "kind", "target", "value", "approvedBy"];

  const escapeCsv = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = rows.map((row) => {
    return headers.map((h) => escapeCsv(row[h as keyof CsvAuditRow] ?? "")).join(",");
  });

  return [headers.join(","), ...lines].join("\n");
}
