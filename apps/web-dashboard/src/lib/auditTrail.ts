import type { PlinthApiClient } from "@plinth/ui-kit";

export interface FailedAudit {
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
}

let pending: FailedAudit[] = [];
const listeners = new Set<(failures: readonly FailedAudit[]) => void>();

const notify = (): void => {
  for (const listener of listeners) listener(pending);
};

/**
 * Subscribes to audit failures so a surface can offer a retry.
 * @returns an unsubscribe function
 */
export const onAuditFailures = (listener: (failures: readonly FailedAudit[]) => void): (() => void) => {
  listeners.add(listener);
  listener(pending);
  return (): void => {
    listeners.delete(listener);
  };
};

/** Audit events waiting to be retried. */
export const getAuditFailures = (): readonly FailedAudit[] => pending;

/**
 * Logs an audit event to the backend and records a retryable failure instead
 * of silently dropping it.
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
  } catch (error: unknown) {
    pending = [
      ...pending,
      { action, targetType, targetId, reason: error instanceof Error ? error.message : "unknown error" },
    ];
    notify();
  }
};

/**
 * Retries every queued audit event; successes leave the queue.
 * @returns how many events are still pending
 */
export const retryAuditFailures = async (client: PlinthApiClient): Promise<number> => {
  const queued = pending;
  const stillFailing: FailedAudit[] = [];
  for (const failure of queued) {
    try {
      await client.ingestAudit({
        action: failure.action,
        target_type: failure.targetType,
        target_id: failure.targetId,
        payload_json: null,
        is_anomaly: false,
      });
    } catch {
      stillFailing.push(failure);
    }
  }
  pending = stillFailing;
  notify();
  return pending.length;
};
