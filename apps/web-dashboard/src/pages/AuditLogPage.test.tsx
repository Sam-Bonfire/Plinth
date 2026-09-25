import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/AuthProvider.js";
import { AuditLogPage } from "./AuditLogPage.js";

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

describe("AuditLogPage", () => {
  it("falls back to sample entries when the service is unreachable", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    expect(await screen.findByText("Void item")).toBeDefined();
    expect(await screen.findByText(/cached sample entries/)).toBeDefined();
  });

  it("filters to anomalies only", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    renderPage();
    await screen.findByText("Void item");
    fireEvent.click(screen.getByRole("radio", { name: "Anomalies" }));
    expect(screen.queryByText("Discount 10%")).toBeNull();
    expect(await screen.findByText("Void item")).toBeDefined();
  });
});
