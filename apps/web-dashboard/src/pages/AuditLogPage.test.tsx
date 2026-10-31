import type { AuditEventDto } from "@plinth/ui-kit";
import { PlinthThemeProvider } from "@plinth/ui-kit";
import { render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/AuthProvider.js";
import { AuditLogPage } from "./AuditLogPage.js";

const liveEvents: AuditEventDto[] = [
  { id: "E-01", actor_id: "ST-01", action: "Discount 10%", target_type: "Order", target_id: "ORD-1098", is_anomaly: false, timestamp: "2026-10-27T12:14:00Z" },
  { id: "E-02", actor_id: "ST-02", action: "Void item", target_type: "OrderLine", target_id: "ORD-1101", is_anomaly: true, timestamp: "2026-10-27T12:02:00Z" },
];

function mockAuditResponse(events: AuditEventDto[]): void {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (): string | null => null },
      json: (): Promise<{ events: AuditEventDto[] }> => Promise.resolve({ events }),
    }),
  ) as unknown as typeof fetch;
}

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <App>
        <AuthProvider>
          <AuditLogPage />
        </AuthProvider>
      </App>
    </PlinthThemeProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuditLogPage", () => {
  it("renders the live audit events from GET /api/v1/audit", async () => {
    mockAuditResponse(liveEvents);
    renderPage();
    expect(await screen.findByText("Void item")).toBeDefined();
    expect(screen.getByText("Discount 10%")).toBeDefined();
    expect(screen.getByText(/Live · 2 events/)).toBeDefined();
    expect(screen.queryByText(/Audit service unavailable/)).toBeNull();
  });



  it("shows an explicit unavailable state and no sample entries when the service fails", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText("Audit service unavailable")).toBeDefined();
    expect(screen.getByText(/No placeholder entries are shown/)).toBeDefined();
    expect(screen.getByText("Audit service unavailable - no events loaded.")).toBeDefined();
    expect(screen.queryByText("Void item")).toBeNull();
    expect(screen.queryByText("Discount 10%")).toBeNull();
  });
});
