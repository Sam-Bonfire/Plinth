import type { Customer } from "../stores/customerStore.js";

export type AudienceSegment = "champions" | "loyal" | "new" | "at-risk" | "dormant";

export function segmentCustomer(customer: Customer): AudienceSegment {
  if (customer.tier === "Gold" || customer.totalSpend >= 20000) {
    return "champions";
  }
  if (customer.tier === "Silver" || customer.visits >= 10) {
    return "loyal";
  }
  if (customer.visits <= 2) {
    return "new";
  }
  if (!customer.isActive) {
    return "dormant";
  }
  return "at-risk";
}

export function segmentAudience(customers: Customer[]): Record<AudienceSegment, Customer[]> {
  const segments: Record<AudienceSegment, Customer[]> = {
    champions: [],
    loyal: [],
    new: [],
    "at-risk": [],
    dormant: [],
  };
  for (const customer of customers) {
    segments[segmentCustomer(customer)].push(customer);
  }
  return segments;
}

const CSV_HEADER = "id,name,phone,tier,visits,total_spend,is_active";

function escapeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function customerRow(customer: Customer): string {
  return [
    customer.id,
    customer.name,
    customer.phone,
    customer.tier,
    customer.visits,
    customer.totalSpend,
    customer.isActive,
  ]
    .map(escapeCsvCell)
    .join(",");
}

/**
 * Streams customers as CSV chunks (header first, then one chunk per row),
 * so large audiences never sit fully in memory as intermediate strings.
 */
export function* streamCustomerCsv(customers: Customer[]): Generator<string, void, void> {
  yield `${CSV_HEADER}\n`;
  for (const customer of customers) {
    yield `${customerRow(customer)}\n`;
  }
}

export function customersToCsv(customers: Customer[]): string {
  let out = "";
  for (const chunk of streamCustomerCsv(customers)) {
    out += chunk;
  }
  return out;
}
