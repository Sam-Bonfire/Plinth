import type { PlinthApiClient } from "@plinth/ui-kit";

export type RoleMatrix = Record<string, Record<string, boolean>>;

export const PERMISSION_LABELS: Record<number, string> = {
  [1 << 0]: "Take orders",
  [1 << 1]: "Apply discounts",
  [1 << 2]: "Void orders",
  [1 << 3]: "Process refunds",
  [1 << 4]: "Modify price",
  [1 << 5]: "View reports",
  [1 << 6]: "Export data",
  [1 << 7]: "Manage staff",
  [1 << 8]: "Edit menu",
  [1 << 9]: "Open and close till",
  [1 << 10]: "Manage mess",
  [1 << 11]: "Manage inventory",
};

export const loadRoleMatrix = async (client: PlinthApiClient): Promise<RoleMatrix> => {
  const { roles } = await client.getStaffPermissions();
  const matrix: RoleMatrix = {};

  for (const [bitStr, capability] of Object.entries(PERMISSION_LABELS)) {
    const bit = parseInt(bitStr, 10);
    matrix[capability] = {};
    for (const [role, roleBits] of Object.entries(roles)) {
      matrix[capability][role] = (roleBits & bit) === bit;
    }
  }

  return matrix;
};
