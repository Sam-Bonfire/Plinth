import { describe, expect, it } from "vitest";
import { TOKENS } from "./tokens.js";

describe("TOKENS surface scale", () => {
  it("defines the muted surfaces referenced by shared components", () => {
    expect(TOKENS.s3).toBe("#eeefee");
    expect(TOKENS.s4).toBe("#e5e7e5");
    expect(TOKENS.s5).toBe("#d8dbd8");
  });
});
