import { describe, expect, it } from "vitest";
import { flushTerminalSync, loadRoleMatrix, queueTerminalSync, saveRoleMatrix, type RoleMatrix, type SyncOp } from "./roleMatrix.js";

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

  it("flushes queued ops and empties the queue", async () => {
    localStorage.clear();
    queueTerminalSync(matrix);
    queueTerminalSync(matrix);

    const sent: SyncOp[] = [];
    const pending = await flushTerminalSync(async (op: SyncOp): Promise<void> => {
      sent.push(op);
    });

    expect(sent).toHaveLength(2);
    expect(pending).toBe(0);
    expect(localStorage.getItem("plinth-terminal-sync-queue")).toBe("[]");
  });

  it("keeps ops that fail to send", async () => {
    localStorage.clear();
    queueTerminalSync(matrix);

    const pending = await flushTerminalSync(async (): Promise<void> => {
      throw new Error("offline");
    });

    expect(pending).toBe(1);
    expect(JSON.parse(localStorage.getItem("plinth-terminal-sync-queue") ?? "[]")).toHaveLength(1);
  });
});
