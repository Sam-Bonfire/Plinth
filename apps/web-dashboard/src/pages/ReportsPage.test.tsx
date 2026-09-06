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
  it("renders period stats, charts and top items", async () => {
    renderPage();
    expect(await screen.findByText("Gross Revenue")).toBeDefined();
    expect(await screen.findByText("₹2,84,510")).toBeDefined();
    expect(await screen.findByText("Revenue Trend")).toBeDefined();
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByTestId("mock-line-chart")).toBeDefined();
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
