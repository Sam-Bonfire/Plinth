import { describe, it, expect } from "vitest";
import { moveCategory, colorFor } from "./menu-ordering.js";

describe("menu-ordering", () => {
  describe("moveCategory", () => {
    it("moves a category up", () => {
      const order = ["A", "B", "C"];
      expect(moveCategory(order, "B", "up")).toEqual(["B", "A", "C"]);
    });

    it("does nothing if moving the first category up", () => {
      const order = ["A", "B", "C"];
      expect(moveCategory(order, "A", "up")).toEqual(["A", "B", "C"]);
    });

    it("moves a category down", () => {
      const order = ["A", "B", "C"];
      expect(moveCategory(order, "B", "down")).toEqual(["A", "C", "B"]);
    });

    it("does nothing if moving the last category down", () => {
      const order = ["A", "B", "C"];
      expect(moveCategory(order, "C", "down")).toEqual(["A", "B", "C"]);
    });

    it("does nothing if category not found", () => {
      const order = ["A", "B", "C"];
      expect(moveCategory(order, "D", "down")).toEqual(["A", "B", "C"]);
    });
  });

  describe("colorFor", () => {
    it("returns the color for a category", () => {
      const prefs = { A: "red", B: "blue" };
      expect(colorFor("A", prefs)).toBe("red");
      expect(colorFor("C", prefs)).toBeUndefined();
    });
  });
});
