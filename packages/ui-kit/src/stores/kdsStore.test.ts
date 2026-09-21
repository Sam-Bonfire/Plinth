import { describe, it, expect, beforeEach } from "vitest";
import { useKdsStore, selectVisibleTickets, selectTicketCounts } from "./kdsStore.js";
import type { KdsTicket } from "./kdsStore.js";

function ticket(overrides: Partial<KdsTicket> = {}): KdsTicket {
  return {
    id: "t-1",
    orderId: "o-1",
    station: "Grill",
    status: "Pending",
    kotNumber: 7,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("KdsStore", () => {
  beforeEach(() => {
    useKdsStore.getState().reset();
  });

  it("upserts and filters by station", () => {
    useKdsStore.getState().setTickets([ticket(), ticket({ id: "t-2", station: "Bar" })]);
    useKdsStore.getState().setActiveStation("Grill");
    expect(selectVisibleTickets(useKdsStore.getState())).toHaveLength(1);
    useKdsStore.getState().upsertTicket(ticket({ id: "t-1", status: "InPrep" }));
    expect(useKdsStore.getState().tickets).toHaveLength(2);
  });

  it("hides terminal tickets and counts by status", () => {
    useKdsStore.getState().setTickets([
      ticket(),
      ticket({ id: "t-2", status: "Bumped" }),
      ticket({ id: "t-3", status: "Ready" }),
    ]);
    expect(selectVisibleTickets(useKdsStore.getState())).toHaveLength(2);
    expect(selectTicketCounts(useKdsStore.getState())).toEqual({
      Pending: 1,
      Bumped: 1,
      Ready: 1,
    });
  });

  it("removes tickets and resets", () => {
    useKdsStore.getState().setTickets([ticket()]);
    useKdsStore.getState().setStatus("t-1", "Cancelled");
    expect(selectVisibleTickets(useKdsStore.getState())).toHaveLength(0);
    useKdsStore.getState().removeTicket("t-1");
    expect(useKdsStore.getState().tickets).toHaveLength(0);
  });
});
