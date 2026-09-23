import { describe, expect, it } from "vitest";
import { buildReprintJob, type TicketView } from "./reprint.js";

describe("buildReprintJob", () => {
  it("formats a basic ticket with items and a timestamp", () => {
    const ticket: TicketView = {
      id: "TICKET-123",
      kot: 123,
      kotLabel: "KOT-123",
      station: "Hot",
      channel: "Dine-in",
      tableName: "Table 1",
      elapsedSeconds: 100,
      sla: "OnTime",
      items: [
        { id: "ITEM-1", name: "Burger", quantity: 2 },
        { id: "ITEM-2", name: "Fries", quantity: 1 },
      ],
    };

    const now = 1700000000000;
    const job = buildReprintJob(ticket, now);

    expect(job.ticketId).toBe("TICKET-123");
    expect(job.queuedAt).toBe(now);
    expect(job.payload_lines).toEqual([
      "2x Burger",
      "1x Fries",
      `Reprinted at: ${new Date(now).toISOString()}`,
    ]);
  });

  it("formats items with modifiers", () => {
    const ticket: TicketView = {
      id: "TICKET-456",
      kot: 456,
      kotLabel: "KOT-456",
      station: "Hot",
      channel: "Takeaway",
      tableName: "",
      elapsedSeconds: 50,
      sla: "Warning",
      items: [
        {
          id: "ITEM-3",
          name: "Burger",
          quantity: 1,
          modifiers: ["No onions", "Extra cheese"],
        },
      ],
    };

    const now = 1700000000000;
    const job = buildReprintJob(ticket, now);

    expect(job.payload_lines).toEqual([
      "1x Burger",
      "  + No onions",
      "  + Extra cheese",
      `Reprinted at: ${new Date(now).toISOString()}`,
    ]);
  });
});
