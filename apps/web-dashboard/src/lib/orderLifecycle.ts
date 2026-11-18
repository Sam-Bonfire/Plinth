export type OrderStatus =
  | "Draft"
  | "Confirmed"
  | "Preparing"
  | "Ready"
  | "Served"
  | "Settled"
  | "Voided"
  | "Cancelled"
  | "Refunded";

export type AdvanceRefusal = "already_advanced" | "terminal" | "unknown";

export type VoidRefusal = "already_voided" | "settled" | "refunded" | "cancelled";

export type TenderRefusal = "not_cash" | "missing_tender" | "short_tender";

export type OrderAdvanceResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; reason: AdvanceRefusal };

export type OrderVoidResult =
  | { ok: true; status: "Voided" }
  | { ok: false; reason: VoidRefusal };

export type TenderResult =
  | { ok: true; changeMinor: number }
  | { ok: false; reason: TenderRefusal; shortfallMinor?: number };

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Preparing: "Ready",
  Ready: "Served",
  Served: "Settled",
};

const TERMINAL: ReadonlySet<OrderStatus> = new Set(["Settled", "Voided", "Cancelled", "Refunded"]);

/** Advances an order exactly one step. Terminal or unknown states are refused. */
export function advanceOrder(status: string): OrderAdvanceResult {
  const current = status as OrderStatus;
  const next = NEXT_STATUS[current];
  if (next !== undefined) return { ok: true, status: next };
  if (TERMINAL.has(current)) return { ok: false, reason: "terminal" };
  return { ok: false, reason: "unknown" };
}

/** Voids an order unless it is already voided or money has settled/closed. */
export function voidOrder(status: string): OrderVoidResult {
  if (status === "Voided") return { ok: false, reason: "already_voided" };
  if (status === "Settled") return { ok: false, reason: "settled" };
  if (status === "Refunded") return { ok: false, reason: "refunded" };
  if (status === "Cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true, status: "Voided" };
}

/**
 * Validates a cash tender against a total, both in integer minor units.
 * Non-cash methods settle without a tendered amount.
 */
export function settleTender(
  method: string,
  totalMinor: number,
  tenderedMinor: number | null,
): TenderResult {
  if (method !== "Cash") return { ok: true, changeMinor: 0 };
  if (tenderedMinor === null || !(tenderedMinor > 0)) {
    return { ok: false, reason: "missing_tender" };
  }
  if (tenderedMinor < totalMinor) {
    return { ok: false, reason: "short_tender", shortfallMinor: totalMinor - tenderedMinor };
  }
  return { ok: true, changeMinor: tenderedMinor - totalMinor };
}
