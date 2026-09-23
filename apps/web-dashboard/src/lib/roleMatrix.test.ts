import { describe, expect, it } from "vitest";
import { loadRoleMatrix, queueTerminalSync, saveRoleMatrix, type RoleMatrix } from "./roleMatrix.js";

const matrix: RoleMatrix = {
  "Apply discounts": { Owner: true, Manager: true, Cashier: false, Kitchen: false },
};

describe("roleMatrix", () => {
  it("returns fallback when storage is empty or corrupt", () => {
    localStorage.clear();
    expect(loadRoleMatrix(matrix)).toEqual(matrix);
    localStorage.setItem("plinth-role-matrix", "not-json{{");
    expect(loadRoleMatrix(matrix)).toEqual(matrix);
    localStorage.setItem("plinth-role-matrix", JSON.stringify({ bogus: [1, 2] }));
    expect(loadRoleMatrix(matrix)).toEqual(matrix);
  });

  it("round-trips a saved matrix", () => {
    localStorage.clear();
    saveRoleMatrix(matrix);
    expect(loadRoleMatrix({})).toEqual(matrix);
  });

  it("queues terminal sync ops and reports depth", () => {
    localStorage.clear();
    expect(queueTerminalSync(matrix)).toBe(1);
    expect(queueTerminalSync(matrix)).toBe(2);
    const raw = localStorage.getItem("plinth-terminal-sync-queue") ?? "[]";
    const queue = JSON.parse(raw) as { type: string }[];
    expect(queue).toHaveLength(2);
    expect(queue[0]?.type).toBe("role-matrix");
  });
});
