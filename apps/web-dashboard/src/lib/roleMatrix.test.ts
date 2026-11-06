import type { PlinthApiClient } from "@plinth/ui-kit";
import { describe, expect, it } from "vitest";
import { loadRoleMatrix } from "./roleMatrix.js";
describe("roleMatrix", () => {
  it("builds the correct role matrix based on domain bitmasks", async () => {
    const mockClient = {
      getStaffPermissions: async () => ({
        roles: {
          Manager: 0b0000_0010_0000_0010, // OPEN_CLOSE_TILL (512) and APPLY_DISCOUNTS (2)
          Cashier: 0b0000_0000_0000_0001  // TAKE_ORDERS (1)
        }
      })
    } as unknown as PlinthApiClient;

    const matrix = await loadRoleMatrix(mockClient);

    // Manager should have Apply discounts
    expect(matrix["Apply discounts"]?.Manager).toBe(true);
    expect(matrix["Open and close till"]?.Manager).toBe(true);
    expect(matrix["Take orders"]?.Manager).toBe(false);

    // Cashier should have Take orders
    expect(matrix["Take orders"]?.Cashier).toBe(true);
    expect(matrix["Apply discounts"]?.Cashier).toBe(false);
  });
});
