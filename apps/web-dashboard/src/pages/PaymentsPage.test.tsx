import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentsPage } from "./PaymentsPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Pie: () => <div data-testid="mock-pie-chart" />,
}));

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <PaymentsPage />
    </PlinthThemeProvider>,
  );
}

describe("PaymentsPage", () => {
  it("renders collection stats and the transaction log", async () => {
    renderPage();
    expect(await screen.findByText("Collected Today")).toBeDefined();
    expect(await screen.findByText("TXN-9001")).toBeDefined();
    expect(await screen.findByText("Aggregator Reconciliation")).toBeDefined();
    expect(await screen.findByText("Refund velocity")).toBeDefined();
  });

  it("filters transactions by method", async () => {
    renderPage();
    await screen.findByText("TXN-9001");
    const filters = screen.getAllByRole("radiogroup");
    const methodInputs = within(filters[0] as HTMLElement).getAllByRole("radio");
    fireEvent.click(methodInputs[3] as HTMLElement);
    expect(screen.queryByText("TXN-9001")).toBeNull();
    expect(await screen.findByText("TXN-9004")).toBeDefined();
  });

  it("processes a refund from the row action", async () => {
    renderPage();
    await screen.findByText("TXN-9001");
    const refunds = screen.getAllByRole("button", { name: "Refund" });
    fireEvent.click(refunds[0] as HTMLElement);
    expect(await screen.findByText(/Refunding/)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Refund" }));
    expect(await screen.findByText(/processed/)).toBeDefined();
    expect(await screen.findByText("Refunded")).toBeDefined();
  }, 15000);

  it("records a cash variance", async () => {
    renderPage();
    await screen.findByText("TXN-9001");
    fireEvent.click(await screen.findByRole("button", { name: "Cash Variance" }));
    expect(await screen.findByText(/Expected in drawer/)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Record Variance" }));
    expect(await screen.findByText(/variance.*recorded/)).toBeDefined();
  }, 15000);

  it("runs reconciliation on demand", async () => {
    renderPage();
    await screen.findByText("TXN-9001");
    fireEvent.click(await screen.findByRole("button", { name: "Run Now" }));
    expect(await screen.findByText(/Reconciliation complete/)).toBeDefined();
  });
});
