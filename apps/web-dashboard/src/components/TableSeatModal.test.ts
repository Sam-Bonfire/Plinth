import { describe, expect, it } from "vitest";
import { validateSeating } from "./TableSeatModal.js";

describe("validateSeating", () => {
  it("accepts a party size >= 1 with a waiter", () => {
    expect(validateSeating(2, "Ravi")).toEqual([]);
  });

  it("rejects missing party size and missing waiter", () => {
    expect(validateSeating(null, "Ravi")).toContain("Party size must be at least 1.");
    expect(validateSeating(0, "Ravi")).toContain("Party size must be at least 1.");
    expect(validateSeating(2, "  ")).toContain("Assign a waiter.");
  });
});
