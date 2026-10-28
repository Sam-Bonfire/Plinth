/**
 * One order line, priced in integer minor units.
 *
 * A line's identity is the item plus the options chosen plus the price it was
 * added at, so re-adding the same thing merges into one line while a price
 * change starts a new line instead of silently repricing an existing one.
 */
export interface CartLine {
  key: string;
  itemId: string;
  name: string;
  detail: string;
  qty: number;
  unitPriceMinor: number;
  gstRatePercent: number;
}

/** A line before the cart assigns its key and quantity. */
export type CartLineInput = Omit<CartLine, "key" | "qty">;

export interface CartTotals {
  subtotalMinor: number;
  gstMinor: number;
  count: number;
}

/** The identity a line would have if added to the cart. */
export const cartLineKey = (line: CartLineInput): string =>
  `${line.itemId}|${line.detail}|${line.unitPriceMinor}`;

/** Adds one unit of an item, merging into the matching line when present. */
export const addLine = (lines: readonly CartLine[], item: CartLineInput): CartLine[] => {
  const key = cartLineKey(item);
  if (lines.some((l: CartLine): boolean => l.key === key)) {
    return lines.map((l: CartLine): CartLine => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
  }
  return [...lines, { ...item, key, qty: 1 }];
};

/** Sets a line's quantity; zero or less removes the line. */
export const setLineQty = (lines: readonly CartLine[], key: string, qty: number): CartLine[] =>
  qty < 1
    ? lines.filter((l: CartLine): boolean => l.key !== key)
    : lines.map((l: CartLine): CartLine => (l.key === key ? { ...l, qty } : l));

export const removeLine = (lines: readonly CartLine[], key: string): CartLine[] =>
  lines.filter((l: CartLine): boolean => l.key !== key);

/**
 * Subtotal, GST and unit count for a set of lines.
 *
 * GST is rounded per line so the sum of printed line taxes always equals the
 * printed tax total.
 */
export const cartTotals = (lines: readonly CartLine[]): CartTotals => {
  let subtotalMinor = 0;
  let gstMinor = 0;
  let count = 0;
  for (const line of lines) {
    const lineMinor = line.qty * line.unitPriceMinor;
    subtotalMinor += lineMinor;
    gstMinor += Math.round((lineMinor * line.gstRatePercent) / 100);
    count += line.qty;
  }
  return { subtotalMinor, gstMinor, count };
};
