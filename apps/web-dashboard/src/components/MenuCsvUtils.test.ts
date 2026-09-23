import { type MenuItem } from "@plinth/ui-kit";
import { describe, expect, it } from "vitest";
import { exportMenuToCsv, parseMenuCsv } from "./MenuCsvUtils.js";

describe("MenuCsvUtils", () => {
  describe("exportMenuToCsv", () => {
    it("should export menu items to a CSV string", () => {
      const items: MenuItem[] = [
        {
          id: "1",
          name: "Burger",
          price: 10,
          categoryId: "cat1",
          isAvailable: true,
          gstRate: 0,
          isVeg: false,
          modifierGroups: [],
        },
        {
          id: "2",
          name: "Fries",
          price: 5,
          categoryId: "cat2",
          isAvailable: false,
          gstRate: 0,
          isVeg: true,
          modifierGroups: [],
        },
      ];

      const csv = exportMenuToCsv(items);
      const lines = csv.split("\n");

      expect(lines.length).toBe(3);
      expect(lines[0]).toBe("id,name,price,category,is_available");
      expect(lines[1]).toBe("1,Burger,10,cat1,true");
      expect(lines[2]).toBe("2,Fries,5,cat2,false");
    });

    it("should properly escape fields containing commas, quotes, or newlines", () => {
      const items: MenuItem[] = [
        {
          id: "1",
          name: 'Burger, "Deluxe"',
          price: 15,
          categoryId: "cat1",
          isAvailable: true,
          gstRate: 0,
          isVeg: false,
          modifierGroups: [],
        },
      ];

      const csv = exportMenuToCsv(items);
      const lines = csv.split("\n");

      expect(lines[1]).toBe('1,"Burger, ""Deluxe""",15,cat1,true');
    });
  });

  describe("parseMenuCsv", () => {
    it("should parse valid menu CSV string", () => {
      const csv = `id,name,price,category,is_available
1,Burger,10,cat1,true
2,Fries,5,cat2,false`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.validItems).toHaveLength(2);
      expect(result.validItems[0]).toEqual({
        id: "1",
        name: "Burger",
        price: 10,
        categoryId: "cat1",
        isAvailable: true,
      });
      expect(result.validItems[1]).toEqual({
        id: "2",
        name: "Fries",
        price: 5,
        categoryId: "cat2",
        isAvailable: false,
      });
    });

    it("should handle correctly quoted fields", () => {
      const csv = `id,name,price,category,is_available\n1,"Burger, ""Deluxe""",15,cat1,true`;
      const result = parseMenuCsv(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.validItems).toHaveLength(1);
      expect(result.validItems[0]?.name).toBe('Burger, "Deluxe"');
    });

    it("should return an error for invalid header", () => {
      const csv = `id,name,price,category`; // missing is_available
      const result = parseMenuCsv(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain("Invalid header");
    });

    it("should return an error for an empty file", () => {
      const csv = ``;
      const result = parseMenuCsv(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe("File is empty");
    });

    it("should return errors for invalid rows", () => {
      const csv = `id,name,price,category,is_available
1,,10,cat1,true
2,Fries,abc,cat2,false
3,Drink,-5,cat3,true
,Soda,5,cat4,true
4,Salad,10,,true`;

      const result = parseMenuCsv(csv);

      expect(result.errors).toHaveLength(5);
      expect(result.errors.find((e) => e.row === 2)?.message).toBe("Missing name");
      expect(result.errors.find((e) => e.row === 3)?.message).toBe("Invalid price");
      expect(result.errors.find((e) => e.row === 4)?.message).toBe("Invalid price");
      expect(result.errors.find((e) => e.row === 5)?.message).toBe("Missing id");
      expect(result.errors.find((e) => e.row === 6)?.message).toBe("Missing category");
    });
  });
});
