export type MenuLang = "en" | "hi";

const HI_CATEGORIES: Record<string, string> = {
  Starters: "स्टार्टर्स",
  "Main Course": "मेन कोर्स",
  "Tandoor & Breads": "तंदूर और ब्रेड",
  Desserts: "मिठाइयाँ",
  Beverages: "पेय पदार्थ",
};

/** Localizes a seeded category name; unknown names fall back to English. */
export const localizeCategory = (name: string, lang: MenuLang): string => {
  if (lang === "en") return name;
  return HI_CATEGORIES[name] ?? name;
};
