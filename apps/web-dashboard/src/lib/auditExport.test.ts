import { describe, expect, it } from "vitest";
import { buildAuditCsv, type CsvAuditRow } from "./auditExport.js";

describe("buildAuditCsv", () => {
  it("builds a simple CSV", () => {
    const rows: CsvAuditRow[] = [
      {
        time: "12:14",
        actor: "Rajesh K",
        role: "Manager",
        action: "Discount 10%",
        kind: "Discounts",
        target: "ORD-1098",
        value: "-₹61",
        approvedBy: "Self",
      },
    ];
    const csv = buildAuditCsv(rows);
    expect(csv).toEqual(
      `time,actor,role,action,kind,target,value,approvedBy
12:14,Rajesh K,Manager,Discount 10%,Discounts,ORD-1098,-₹61,Self`
    );
  });

  it("escapes fields with commas, quotes, and newlines", () => {
    const rows: CsvAuditRow[] = [
      {
        time: "12:00",
        actor: 'Jane "Doe", Jr.',
        role: "Cashier",
        action: "Multiline\nAction",
        kind: "General",
        target: "None",
        value: 'A "quote"',
        approvedBy: "Self",
      },
    ];
    const csv = buildAuditCsv(rows);
    expect(csv).toEqual(
      `time,actor,role,action,kind,target,value,approvedBy
12:00,"Jane ""Doe"", Jr.",Cashier,"Multiline\nAction",General,None,"A ""quote""",Self`
    );
  });
});
