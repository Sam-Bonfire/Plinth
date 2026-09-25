import type { PlinthApiClient } from "@plinth/ui-kit";
import { describe, it, expect, vi } from "vitest";
import { logAudit } from "./auditTrail.js";

describe("logAudit", () => {
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
  });

  it("swallows failures silently", async () => {
    const client = {
      ingestAudit: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as PlinthApiClient;

    // Should not throw
    await expect(logAudit(client, "VOID_ORDER", "order", "ORD-123")).resolves.toBeUndefined();
  });
});
