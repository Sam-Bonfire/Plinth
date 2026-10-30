import type { PlinthApiClient } from "@plinth/ui-kit";
import { PlinthThemeProvider } from "@plinth/ui-kit";
import { BusinessConfigProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { OrdersPage } from "./OrdersPage.js";

const getMockAuthContext = (mockClientArgs?: Partial<PlinthApiClient>) => ({
  isAuthenticated: true,
  isRestoring: false,
  tenantId: "t1",
  locationId: "l1",
  login: async (): Promise<void> => {},
  logout: (): void => {},
  client: {
    ingestAudit: vi.fn().mockResolvedValue({}),
    listOrders: vi.fn().mockResolvedValue({
      data: [
        {
          id: "ORD-1098",
          status: "Preparing",
          channel: "DineIn",
          terminal_id: "t1",
          table_id: null,
          grand_total_minor: 1000,
          balance_due_minor: 0,
          created_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "SW-9921",
          status: "Preparing",
          channel: "Swiggy",
          terminal_id: "t2",
          table_id: null,
          grand_total_minor: 1500,
          balance_due_minor: 0,
          created_at: "2023-01-01T00:00:00Z",
        },
      ],
    }),
    ...mockClientArgs,
  } as unknown as PlinthApiClient,
});

function renderPage(mockClientArgs?: Partial<PlinthApiClient>): void {
  render(
    <AuthContext.Provider value={getMockAuthContext(mockClientArgs)}>
      <BusinessConfigProvider>
        <PlinthThemeProvider>
        <OrdersPage />
      </PlinthThemeProvider>
      </BusinessConfigProvider>
    </AuthContext.Provider>,
  );
}

describe("OrdersPage", () => {
  it("renders orders from backend with channel and status badges", async () => {
    renderPage();
    expect(await screen.findByText("ORD-1098")).toBeDefined();
    expect(await screen.findByText("SW-9921")).toBeDefined();
    expect(await screen.findByTestId("channel-badge-dinein")).toBeDefined();
    expect((await screen.findAllByTestId("status-badge-preparing")).length).toBeGreaterThan(0);
  });

  it("filters by channel", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const filters = screen.getAllByRole("radiogroup");
    const channelInputs = within(filters[1] as HTMLElement).getAllByRole("radio");
    fireEvent.click(channelInputs[3] as HTMLElement);
    expect(await screen.findByText("SW-9921")).toBeDefined();
    expect(screen.queryByText("ORD-1098")).toBeNull();
  });

  it("advances an order to the next status", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const advances = screen.getAllByRole("button", { name: "Advance" });
    fireEvent.click(advances[0] as HTMLElement);
    expect(await screen.findByTestId("status-badge-ready")).toBeDefined();
  });

  it("voids an order through the confirm popover", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const voids = screen.getAllByRole("button", { name: "Void" });
    fireEvent.click(voids[0] as HTMLElement);
    expect(await screen.findByText("Void this order?")).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(await screen.findByTestId("status-badge-voided")).toBeDefined();
  });

  it("opens the order detail modal", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const views = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(views[0] as HTMLElement);
    expect(await screen.findByText("Order ORD-1098")).toBeDefined();
  });

  it("exposes live tracking as a tab", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    fireEvent.click(screen.getByRole("tab", { name: "Live Tracking" }));
    expect(await screen.findByText("Track Your Order")).toBeDefined();
  });

  it("shows empty state on failure", async () => {
    renderPage({
      listOrders: vi.fn().mockRejectedValue(new Error("API Error")),
    });

    expect(await screen.findByText("No orders match the current filters.")).toBeDefined();
  });
});
