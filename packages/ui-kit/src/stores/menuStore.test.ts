import { describe, it, expect, beforeEach } from "vitest";
import { useMenuStore, selectVisibleItems, selectUnavailableCount } from "./menuStore.js";

describe("MenuStore", () => {
  beforeEach(() => {
    useMenuStore.getState().reset();
  });

  it("filters by category and query", () => {
    useMenuStore.getState().setMenu(
      [
        { id: "m-1", name: "Burger", price: 200, categoryId: "c-1", isAvailable: true },
        { id: "m-2", name: "Fries", price: 100, categoryId: "c-2", isAvailable: true },
      ],
      [
        { id: "c-1", name: "Mains" },
        { id: "c-2", name: "Sides" },
      ],
    );
    useMenuStore.getState().setActiveCategory("c-1");
    expect(selectVisibleItems(useMenuStore.getState())).toHaveLength(1);
    useMenuStore.getState().setActiveCategory(null);
    useMenuStore.getState().setQuery("fri");
    expect(selectVisibleItems(useMenuStore.getState()).map((i) => i.id)).toEqual(["m-2"]);
  });

  it("toggles availability and counts unavailable", () => {
    useMenuStore.getState().setMenu(
      [{ id: "m-1", name: "Burger", price: 200, categoryId: "c-1", isAvailable: true }],
      [],
    );
    useMenuStore.getState().toggleAvailable("m-1", false);
    expect(selectUnavailableCount(useMenuStore.getState())).toBe(1);
    useMenuStore.getState().toggleAvailable("missing", false);
    expect(selectUnavailableCount(useMenuStore.getState())).toBe(1);
  });
});
