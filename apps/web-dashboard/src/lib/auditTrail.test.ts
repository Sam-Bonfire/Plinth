import type { PlinthApiClient } from "@plinth/ui-kit";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuditFailures, logAudit, onAuditFailures, retryAuditFailures } from "./auditTrail.js";

describe("logAudit", () => {
  beforeEach(async () => {
    // Drain any failures left by a previous test through a no-op client.
    await retryAuditFailures({ ingestAudit: vi.fn().mockResolvedValue({}) } as unknown as PlinthApiClient);
  });

  it("calls client.ingestAudit with correct parameters", async () => {
    const client = {
      ingestAudit: vi.fn().mockResolvedValue({}),
    } as unknown as PlinthApiClient;

    await logAudit(client, "VOID_ORDER", "order", "ORD-123");

    expect(client.ingestAudit).toHaveBeenCalledWith({
      action: "VOID_ORDER",
      target_type: "order",
      target_id: "ORD-123",
      payload_json: null,
      is_anomaly: false,
    });
    expect(getAuditFailures()).toHaveLength(0);
  });

  it("records a retryable failure instead of swallowing it", async () => {
    const client = {
      ingestAudit: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as PlinthApiClient;

    await expect(logAudit(client, "VOID_ORDER", "order", "ORD-123")).resolves.toBeUndefined();

    expect(getAuditFailures()).toHaveLength(1);
    expect(getAuditFailures()[0]?.reason).toBe("Network error");
  });

  it("notifies subscribers and empties the queue once a retry succeeds", async () => {
    const failing = {
      ingestAudit: vi.fn().mockRejectedValue(new Error("offline")),
    } as unknown as PlinthApiClient;
    await logAudit(failing, "PROCESS_REFUND", "payment", "PAY-1");

    const seen: number[] = [];
    const unsubscribe = onAuditFailures((failures): void => {
      seen.push(failures.length);
    });
    expect(seen).toEqual([1]);

    const working = {
      ingestAudit: vi.fn().mockResolvedValue({}),
    } as unknown as PlinthApiClient;
    await expect(retryAuditFailures(working)).resolves.toBe(0);

    expect(seen).toEqual([1, 0]);
    expect(getAuditFailures()).toHaveLength(0);
    unsubscribe();
  });
});
