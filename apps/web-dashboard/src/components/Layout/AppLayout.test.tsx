import { PlinthApiClient, PlinthThemeProvider } from "@plinth/ui-kit";
import { render, screen } from "@testing-library/react";
import { App } from "antd";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../providers/AuthProvider.js";
import { AppLayout } from "./AppLayout.js";

const renderLayout = (client: Partial<PlinthApiClient>): void => {
  render(
    <AuthContext.Provider
      // Cast keeps this test compiling either side of the pending isRestoring field.
      value={{
        isAuthenticated: true,
        isRestoring: false,
        tenantId: "t1",
        locationId: "l1",
        login: async (): Promise<void> => {},
        logout: (): void => {},
        client: client as PlinthApiClient,
      } as AuthContextValue}
    >
      <PlinthThemeProvider>
        <App>
          <MemoryRouter initialEntries={["/orders"]}>
            <AppLayout />
          </MemoryRouter>
        </App>
      </PlinthThemeProvider>
    </AuthContext.Provider>,
  );
};

describe("AppLayout health indicator", () => {
  it("shows live when the edge reports a reachable database", async () => {
    renderLayout({
      getHealth: vi.fn().mockResolvedValue({
        status: "ok",
        version: "0.1.0",
        uptime_secs: 12,
        d1_reachable: true,
      }),
    });
    expect(await screen.findByText("All systems live")).toBeDefined();
  });

  it("shows a degraded state when the database is down", async () => {
    renderLayout({
      getHealth: vi.fn().mockResolvedValue({
        status: "ok",
        version: "0.1.0",
        uptime_secs: 12,
        d1_reachable: false,
      }),
    });
    expect(await screen.findByText("Database unreachable")).toBeDefined();
  });

  it("shows unreachable when the health probe fails", async () => {
    renderLayout({ getHealth: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(await screen.findByText("API unreachable")).toBeDefined();
  });
});
