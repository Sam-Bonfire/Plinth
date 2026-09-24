export interface ReceivableLine {
  item: string;
  qty: number;
}

export interface StockRow {
  key: string;
  name: string;
  current: number;
}

export interface ReceiveResult<T extends StockRow> {
  updated: T[];
  received: number;
  unmatched: string[];
}

/** Applies PO lines to stock levels, matching by case-insensitive name. */
export const receivePurchaseOrder = <T extends StockRow>(rows: T[], lines: ReceivableLine[]): ReceiveResult<T> => {
  const unmatched: string[] = [];
  let received = 0;
  const updated = rows.map((r: T): T => {
    const line = lines.find((l: ReceivableLine): boolean => l.item.trim().toLowerCase() === r.name.trim().toLowerCase());
    if (!line || !(line.qty > 0)) return r;
    received += 1;
    return { ...r, current: r.current + line.qty };
  });
  for (const l of lines) {
    const known = rows.some((r: T): boolean => r.name.trim().toLowerCase() === l.item.trim().toLowerCase());
    if (!known) unmatched.push(l.item);
  }
  return { updated, received, unmatched };
};
