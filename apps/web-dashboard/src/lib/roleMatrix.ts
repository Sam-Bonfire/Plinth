export type RoleMatrix = Record<string, Record<string, boolean>>;

const MATRIX_KEY = "plinth-role-matrix";
const SYNC_QUEUE_KEY = "plinth-terminal-sync-queue";

export interface SyncOp {
  type: "role-matrix";
  matrix: RoleMatrix;
  queuedAt: string;
}

const isMatrix = (v: unknown): v is RoleMatrix => {
  if (typeof v !== "object" || v === null) return false;
  return Object.values(v as Record<string, unknown>).every(
    (row: unknown): boolean =>
      typeof row === "object" &&
      row !== null &&
      Object.values(row as Record<string, unknown>).every((cell: unknown): boolean => typeof cell === "boolean"),
  );
};

export const loadRoleMatrix = (fallback: RoleMatrix): RoleMatrix => {
  try {
    const raw = localStorage.getItem(MATRIX_KEY);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isMatrix(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const saveRoleMatrix = (matrix: RoleMatrix): void => {
  try {
    localStorage.setItem(MATRIX_KEY, JSON.stringify(matrix));
  } catch {
    // Storage unavailable: matrix stays in memory only.
  }
};

/** Queues the matrix for terminal sync; returns the queue depth after enqueue. */
export const queueTerminalSync = (matrix: RoleMatrix): number => {
  let queue: SyncOp[] = [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) queue = parsed as SyncOp[];
    }
  } catch {
    queue = [];
  }
  queue.push({ type: "role-matrix", matrix, queuedAt: new Date().toISOString() });
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage unavailable: report the in-memory depth.
  }
  return queue.length;
};
