import { PlinthThemeProvider, type KitchenTicketDto } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/AuthProvider.js";
import { KitchenPage, mapDtoToView } from "./KitchenPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <AuthProvider>
        <KitchenPage />
      </AuthProvider>
    </PlinthThemeProvider>,
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
  it("renders station columns with seeded tickets", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText(/Main Kitchen/)).toBeDefined();
    expect(await screen.findByText("#42")).toBeDefined();
    expect(await screen.findByText("14:00")).toBeDefined();
  });

  it("bumps a ticket off the board", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    await screen.findByText("#42");
    const bumps = screen.getAllByRole("button", { name: "BUMP" });
    fireEvent.click(bumps[0] as HTMLElement);
    expect(await screen.findByText(/bumped/)).toBeDefined();
    expect(screen.queryByText("#42")).toBeNull();
  });

  it("injects a test order onto the board", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    await screen.findByText("#42");
    fireEvent.click(await screen.findByRole("button", { name: /Inject Test Order/ }));
    expect(await screen.findByText("#45")).toBeDefined();
  });

  it("shows live tickets from the backend when reachable", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([liveDto]),
      }),
    ) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText("#7")).toBeDefined();
    expect(await screen.findByText(/Dal Makhani/)).toBeDefined();
    expect(screen.queryByText(/live kitchen service unreachable/)).toBeNull();
  });

  it("falls back to cached samples with a banner when offline", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText(/live kitchen service unreachable/)).toBeDefined();
    expect(await screen.findByText("#42")).toBeDefined();
  });
});
