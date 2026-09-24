import type { KDSTicketItem } from "@plinth/ui-kit";

export interface TicketView {
  id: string;
  kot: number;
  kotLabel: string;
  station: string;
  channel: string;
  tableName: string;
  elapsedSeconds: number;
  sla: "OnTime" | "Warning" | "Late";
  items: KDSTicketItem[];
}

export interface ReprintJob {
  ticketId: string;
  payload_lines: string[];
  queuedAt: number;
}

export const buildReprintJob = (ticket: TicketView, nowMs: number = Date.now()): ReprintJob => {
  const lines: string[] = [];

  for (const item of ticket.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        lines.push(`  + ${mod}`);
      }
    }
  }

  lines.push(`Reprinted at: ${new Date(nowMs).toISOString()}`);

  return {
    ticketId: ticket.id,
    payload_lines: lines,
    queuedAt: nowMs,
  };
};
