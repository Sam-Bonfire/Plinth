import { PlinthThemeProvider } from "@plinth/ui-kit";
import type { PlinthApiClient } from "@plinth/ui-kit";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { DashboardPage } from "./DashboardPage.js";

const renderPage = (client: PlinthApiClient): void => {
  render(
    <AuthContext.Provider
      value={{ isAuthenticated: true, tenantId: "t1", locationId: "l1", login: async () => {}, logout: () => {}, client }}
    >
      <PlinthThemeProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </PlinthThemeProvider>
    </AuthContext.Provider>,
  );
};

describe("DashboardPage", () => {
  it("marks the figures unavailable when the analytics service fails", async () => {
    renderPage({
      getSalesReport: async () => {
        throw new Error("unreachable");
      },
    } as unknown as PlinthApiClient);

    expect(await screen.findByText(/figures below are unavailable/)).toBeDefined();
    // No invented sample numbers, and unreported tiles stay unknown.
    expect(screen.queryByText("12")).toBeNull();
    expect(screen.queryByText("3")).toBeNull();
    expect((await screen.findAllByText("—")).length).toBeGreaterThanOrEqual(4);
  });

  it("shows live sales and orders from the report", async () => {
    renderPage({
      getSalesReport: async () => ({
        total_revenue_minor: 250000,
        total_orders: 15,
        hourly_volume: {},
        payment_distribution: {},
        tax_liability_minor: 5000,
      }),
    } as unknown as PlinthApiClient);

    expect(await screen.findByText("2,500")).toBeDefined();
    expect(await screen.findByText("15")).toBeDefined();
    expect(screen.queryByText(/figures below are unavailable/)).toBeNull();
  });
});
