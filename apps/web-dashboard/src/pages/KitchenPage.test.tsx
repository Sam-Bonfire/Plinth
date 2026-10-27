import { PlinthThemeProvider, type KitchenTicketDto, type PlinthApiClient } from "@plinth/ui-kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { KitchenPage, mapDtoToView } from "./KitchenPage.js";

function renderPage(mockClient?: Partial<PlinthApiClient>): void {
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        tenantId: "t1",
        locationId: "l1",
        login: async (): Promise<void> => {},
        logout: (): void => {},
        client: (mockClient ?? {}) as unknown as PlinthApiClient,
      }}
    >
      <PlinthThemeProvider>
        <KitchenPage />
      </PlinthThemeProvider>
    </AuthContext.Provider>,
  );
}

const liveDto: KitchenTicketDto = {
  id: "KT-LIVE-1",
  order_id: "ord-abcdef123456",
  tenant_id: "t1",
  location_id: "l1",
  station: "MainKitchen",
  kot_number: 7,
  items: [
    {
      line_item_id: "li1",
      menu_item_id: "m1",
      name: "Dal Makhani",
      quantity: 2,
      modifiers: [{ group_id: "g1", selected_options: ["Full"], special_instructions: null }],
      special_instructions: "Less spicy",
    },
  ],
  status: "InPrep",
  sla: { threshold_warning: { secs: 240, nanos: 0 }, threshold_late: { secs: 480, nanos: 0 } },
  created_at: new Date(Date.now() - 90_000).toISOString(),
  bumped_at: null,
  bumped_by: null,
  cancelled_at: null,
  cancellation_reason: null,
  sla_status: "OnTime",
};

describe("mapDtoToView", () => {
  it("maps backend tickets with elapsed time and flattened modifiers", () => {
    const nowMs = Date.parse(liveDto.created_at) + 90_000;
    const view = mapDtoToView(liveDto, nowMs);
    expect(view.id).toBe("KT-LIVE-1");
    expect(view.kot).toBe(7);
    expect(view.kotLabel).toBe("KOT-7");
    expect(view.station).toBe("Main Kitchen");
    expect(view.elapsedSeconds).toBe(90);
    expect(view.sla).toBe("OnTime");
    expect(view.items).toEqual([
      { id: "KT-LIVE-1-LI-0", name: "Dal Makhani", quantity: 2, modifiers: ["Full"], notes: "Less spicy" },
    ]);
  });
});

describe("KitchenPage", () => {
  it("shows live tickets from the backend when reachable", async () => {
    const mockClient = {
      listKitchenTickets: vi.fn().mockResolvedValue([liveDto]),
    };
    renderPage(mockClient as unknown as Partial<PlinthApiClient>);

    expect(await screen.findByText("#7")).toBeDefined();
    expect(await screen.findByText(/Dal Makhani/)).toBeDefined();
    expect(screen.queryByText(/live kitchen service unreachable/i)).toBeNull();
  });

  it("bumps a ticket off the board", async () => {
    const mockClient = {
      listKitchenTickets: vi.fn().mockResolvedValue([liveDto]),
      bumpTicket: vi.fn().mockResolvedValue(liveDto),
    };
    renderPage(mockClient as unknown as Partial<PlinthApiClient>);

    await screen.findByText("#7");
    const bumps = screen.getAllByRole("button", { name: "BUMP" });
    fireEvent.click(bumps[0] as HTMLElement);

    expect(await screen.findByText(/bumped/)).toBeDefined();
    await waitFor((): void => {
      expect(screen.queryByText("#7")).toBeNull();
    });
  });

  it("falls back to empty state with a banner when offline", async () => {
    const mockClient = {
      listKitchenTickets: vi.fn().mockRejectedValue(new Error("offline")),
    };
    renderPage(mockClient as unknown as Partial<PlinthApiClient>);

    expect(await screen.findByText(/live kitchen service unreachable/i)).toBeDefined();
    expect(await screen.findByText(/No Active Tickets/i)).toBeDefined();
  });
});
