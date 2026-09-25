import type { PlinthApiClient } from "@plinth/ui-kit";

/**
 * Logs an audit event to the backend.
 * Swallows failures silently (fire-and-forget).
 * @param client The API client instance
 * @param action The action performed
 * @param targetType The type of the target
 * @param targetId The ID of the target
 */
export const logAudit = async (
  client: PlinthApiClient,
  action: string,
  targetType: string,
  targetId: string,
): Promise<void> => {
  try {
    await client.ingestAudit({
      action,
      target_type: targetType,
      target_id: targetId,
      payload_json: null,
      is_anomaly: false,
    });
  } catch {
    // Swallow failures silently (fire-and-forget)
  }
};
