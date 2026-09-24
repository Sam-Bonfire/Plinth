import { describe, expect, it } from "vitest";
import { localizeCategory } from "./menuL10n.js";

describe("localizeCategory", () => {
  it("returns English names untouched", () => {
    expect(localizeCategory("Desserts", "en")).toBe("Desserts");
  });

  it("translates seeded categories to Hindi", () => {
    expect(localizeCategory("Starters", "hi")).toBe("स्टार्टर्स");
    expect(localizeCategory("Main Course", "hi")).toBe("मेन कोर्स");
    expect(localizeCategory("Tandoor & Breads", "hi")).toBe("तंदूर और ब्रेड");
    expect(localizeCategory("Desserts", "hi")).toBe("मिठाइयाँ");
    expect(localizeCategory("Beverages", "hi")).toBe("पेय पदार्थ");
  });

  it("falls back to English for unknown names", () => {
    expect(localizeCategory("Chef Specials", "hi")).toBe("Chef Specials");
  });
});
