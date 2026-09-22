import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart bindings.
vi.mock("@ant-design/charts", () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Column: () => <div data-testid="mock-column-chart" />,
}));

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <ReportsPage />
    </PlinthThemeProvider>,
  );
}

describe("ReportsPage", () => {
  it("renders period stats, charts, top items, and tax summary", async () => {
    renderPage();
    expect(await screen.findByText("Gross Revenue")).toBeDefined();
    expect(await screen.findByText("₹2,84,510")).toBeDefined();
    expect(await screen.findByText("Revenue Trend")).toBeDefined();
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByTestId("mock-line-chart")).toBeDefined();

    // Check Tax summary
    expect(await screen.findByText("Tax Liability (GST) Summary")).toBeDefined();
    expect(await screen.findByText("29,840")).toBeDefined(); // (145000*0.05 + 42000*0.12 + 97500*0.18) = 7250 + 5040 + 17550 = 29840
    expect(await screen.findByText("0% (Exempt)")).toBeDefined();
    expect(await screen.findByText("18% (EighteenPercent)")).toBeDefined();
  });

  it("switches reporting period", async () => {
    renderPage();
    await screen.findByText("₹2,84,510");
    const groups = screen.getAllByRole("radiogroup");
    const inputs = within(groups[0] as HTMLElement).getAllByRole("radio");
    fireEvent.click(inputs[0] as HTMLElement);
    expect(await screen.findByText("₹42,310")).toBeDefined();
  });

  it("exports the report", async () => {
    renderPage();
    await screen.findByText("₹2,84,510");
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(await screen.findByText(/CSV report exported/)).toBeDefined();
  });
});
