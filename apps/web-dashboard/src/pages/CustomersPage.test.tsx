import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomersPage } from "./CustomersPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="mock-column-chart" />,
}));

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <CustomersPage />
    </PlinthThemeProvider>,
  );
}

describe("CustomersPage", () => {
  it("renders stats, directory and top customers", async () => {
    renderPage();
    expect(await screen.findByText("Total Customers")).toBeDefined();
    expect((await screen.findAllByText("Aarav Sharma")).length).toBe(2);
    expect(await screen.findByText("Top Customers")).toBeDefined();
    expect(await screen.findByText("Visit Frequency")).toBeDefined();
  });

  it("searches the directory by name", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");
    fireEvent.change(screen.getByPlaceholderText("Search by name/phone…"), { target: { value: "priya" } });
    expect((await screen.findAllByText("Priya Nair")).length).toBe(2);
    expect(screen.queryByText("Vikram Rao")).toBeNull();
  });

  it("adds a new customer through the modal", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.change(await screen.findByPlaceholderText("Customer name"), { target: { value: "Kiran Bose" } });
    fireEvent.change(await screen.findByPlaceholderText("+91 …"), { target: { value: "+91 90000 00000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Kiran Bose")).toBeDefined();
  });

  it("filters the directory by behavioral filters", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");

    // Filter by Min Visits = 20
    const minVisitsInput = screen.getByPlaceholderText("Min Visits");
    fireEvent.change(minVisitsInput, { target: { value: "20" } });

    // Aarav (48), Priya (36), Rohan (21) should be visible
    expect(await screen.findAllByText("Aarav Sharma")).toBeDefined();
    expect(await screen.findAllByText("Rohan Mehta")).toBeDefined();

    // Sneha (12), Vikram (5), Ananya (1) should be hidden
    expect(screen.queryByText("Sneha Iyer")).toBeNull();
    expect(screen.queryByText("Vikram Rao")).toBeNull();
  });

  it("opens the customer profile drawer with timeline", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");

    const views = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(views[0] as HTMLElement);

    expect(await screen.findByText("Customer Profile")).toBeDefined();

    // Check for timeline presence
    expect(await screen.findByText("Activity Timeline")).toBeDefined();

    // The first user has 48 visits, so timeline maxes out at 5 items.
    // Wait for the "Spent" lines to show up which indicates timeline items rendered.
    const spentLines = await screen.findAllByText(/Spent ₹/);
    expect(spentLines.length).toBeGreaterThan(0);
  });
});
