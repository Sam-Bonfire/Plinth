import { describe, it, expect } from "vitest";
import type { Customer } from "../stores/customerStore.js";
import { segmentAudience, segmentCustomer, customersToCsv, streamCustomerCsv } from "./audience.js";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c-1",
    name: "Asha Rao",
    phone: "+919820012345",
    tier: "Regular",
    visits: 0,
    totalSpend: 0,
    isActive: true,
    ...overrides,
  };
}

describe("audience segmentation", () => {
  it("classifies by tier, spend, and activity", () => {
    expect(segmentCustomer(customer({ tier: "Gold" }))).toBe("champions");
    expect(segmentCustomer(customer({ totalSpend: 25000 }))).toBe("champions");
    expect(segmentCustomer(customer({ tier: "Silver" }))).toBe("loyal");
    expect(segmentCustomer(customer({ visits: 12 }))).toBe("loyal");
    expect(segmentCustomer(customer({ visits: 1 }))).toBe("new");
    expect(segmentCustomer(customer({ visits: 5, isActive: false }))).toBe("dormant");
    expect(segmentCustomer(customer({ visits: 5 }))).toBe("at-risk");
  });

  it("groups an audience into every segment", () => {
    const segments = segmentAudience([
      customer({ id: "a", tier: "Gold" }),
      customer({ id: "b", visits: 12 }),
    ]);
    expect(segments.champions.map((c) => c.id)).toEqual(["a"]);
    expect(segments.loyal.map((c) => c.id)).toEqual(["b"]);
    expect(segments.new).toHaveLength(0);
  });
});

describe("customer CSV exporter", () => {
  it("escapes commas, quotes, and newlines", () => {
    const csv = customersToCsv([
      customer({ name: 'Asha "Ash" Rao', phone: "1,2" }),
    ]);
    expect(csv).toContain('"Asha ""Ash"" Rao"');
    expect(csv).toContain('"1,2"');
    expect(csv.split("\n")[0]).toBe("id,name,phone,tier,visits,total_spend,is_active");
  });

  it("streams identical output to the bulk exporter", () => {
    const customers = [customer(), customer({ id: "c-2", name: "Raj" })];
    let streamed = "";
    for (const chunk of streamCustomerCsv(customers)) {
      streamed += chunk;
    }
    expect(streamed).toBe(customersToCsv(customers));
    expect(streamed.split("\n")).toHaveLength(4);
  });
});
