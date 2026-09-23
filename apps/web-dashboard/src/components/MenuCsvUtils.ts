import { type MenuItem } from "@plinth/ui-kit";

export interface ParsedItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  isAvailable: boolean;
}

export interface CsvError {
  row: number;
  message: string;
}

const escapeCsv = (val: string | number | boolean): string => {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportMenuToCsv = (items: MenuItem[]): string => {
  const header = ["id", "name", "price", "category", "is_available"].join(",");
  const rows = items.map((item) =>
    [
      escapeCsv(item.id),
      escapeCsv(item.name),
      escapeCsv(item.price),
      escapeCsv(item.categoryId),
      escapeCsv(item.isAvailable),
    ].join(",")
  );
  return [header, ...rows].join("\n");
};

export const parseMenuCsv = (csv: string): { validItems: ParsedItem[]; errors: CsvError[] } => {
  const validItems: ParsedItem[] = [];
  const errors: CsvError[] = [];

  const lines = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    errors.push({ row: 0, message: "File is empty" });
    return { validItems, errors };
  }

  // Very basic CSV parser that respects quotes
  const parseLine = (line: string): string[] => {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && inQuotes) {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current);
    return row;
  };

  const headerLine = lines[0] ?? "";
  const headers = parseLine(headerLine).map((h) => h.toLowerCase().trim());

  const idIdx = headers.indexOf("id");
  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("price");
  const categoryIdx = headers.indexOf("category");
  const availableIdx = headers.indexOf("is_available");

  if (idIdx === -1 || nameIdx === -1 || priceIdx === -1 || categoryIdx === -1 || availableIdx === -1) {
    errors.push({ row: 1, message: "Invalid header. Required: id, name, price, category, is_available" });
    return { validItems, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const row = parseLine(line);

    // allow missing trailing commas if fields are missing, but just map them gracefully
    const id = (row[idIdx] || "").trim();
    const name = (row[nameIdx] || "").trim();
    const priceStr = (row[priceIdx] || "").trim();
    const category = (row[categoryIdx] || "").trim();
    const isAvailStr = (row[availableIdx] || "").trim().toLowerCase();

    if (!id) {
      errors.push({ row: i + 1, message: "Missing id" });
      continue;
    }
    if (!name) {
      errors.push({ row: i + 1, message: "Missing name" });
      continue;
    }
    if (!priceStr) {
      errors.push({ row: i + 1, message: "Missing price" });
      continue;
    }

    const price = Number(priceStr);
    if (isNaN(price) || price < 0) {
      errors.push({ row: i + 1, message: "Invalid price" });
      continue;
    }
    if (!category) {
      errors.push({ row: i + 1, message: "Missing category" });
      continue;
    }

    const isAvailable = isAvailStr === "true" || isAvailStr === "1" || isAvailStr === "yes";

    validItems.push({
      id,
      name,
      price,
      categoryId: category,
      isAvailable,
    });
  }

  return { validItems, errors };
};
