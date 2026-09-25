import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/AuthProvider.js";
import { CustomersPage, avgRating, upcomingOccasions, type Feedback } from "./CustomersPage.js";

// Canvas-backed chart renders cannot run in jsdom; mock the chart binding.
vi.mock("@ant-design/charts", () => ({
  Column: () => <div data-testid="mock-column-chart" />,
}));

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <AuthProvider>
        <CustomersPage />
      </AuthProvider>
    </PlinthThemeProvider>,
  );
}

describe("upcomingOccasions", () => {
  it("finds dates within standard range and outside", () => {
    // @ts-expect-error partial mock
    const c1: Customer = { name: "Bob", birthday: "05-10" };
    // @ts-expect-error partial mock
    const c2: Customer = { name: "Alice", anniversary: "05-15" };

    // @ts-expect-error test
    const res = upcomingOccasions([c1, c2], "2023-05-08T10:00:00Z", 5);
    expect(res).toHaveLength(1);
    expect(res[0]?.customer.name).toBe("Bob");
  });

  it("handles year wrap around", () => {
    // @ts-expect-error partial mock
    const c1: Customer = { name: "Charlie", birthday: "01-02" };
    // @ts-expect-error test
    const res = upcomingOccasions([c1], "2023-12-30T00:00:00Z", 7);
    expect(res).toHaveLength(1);
    expect(res[0]?.customer.name).toBe("Charlie");
  });

  it("handles leap year tolerance", () => {
    // @ts-expect-error partial mock
    const c1: Customer = { name: "Leap", birthday: "02-29" };

    // In a non-leap year (2023), check if it appears on March 1st equivalent or Feb 28th
    // We implemented it as March 1st. If today is Feb 27, Mar 1 is 2 days away.
    // @ts-expect-error test
    const res = upcomingOccasions([c1], "2023-02-27T00:00:00Z", 7);
    expect(res).toHaveLength(1);
    expect(res[0]?.customer.name).toBe("Leap");

    // In a leap year (2024), check if it appears on Feb 29
    // @ts-expect-error test
    const res2 = upcomingOccasions([c1], "2024-02-27T00:00:00Z", 7);
    expect(res2).toHaveLength(1);
    expect(res2[0]?.customer.name).toBe("Leap");
  });
});

describe("CustomersPage", () => {
  it("renders stats, directory and top customers", async () => {
    renderPage();
    expect(await screen.findByText("Total Customers")).toBeDefined();
    // Directory is the default active tab
    expect((await screen.findAllByText("Aarav Sharma")).length).toBe(2);
    expect(await screen.findByText("Top Customers")).toBeDefined();
    expect(await screen.findByText("Visit Frequency")).toBeDefined();
  });

  it("validates zero amount top-up and tests CSV export", { timeout: 120000 }, async () => {
    const user = userEvent.setup();
    renderPage();
    // Go to Mess Accounts tab
    await user.click(screen.getByRole("tab", { name: "Mess Accounts" }));

    // Top-up first account
    const topUpButtons = await screen.findAllByRole("button", { name: "Top-up" });
    await user.click(topUpButtons[0] as HTMLElement);

    // Scope to the modal dialog once mounted.
    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog as HTMLElement);

    // Enter zero
    await user.clear(modal.getByRole("spinbutton"));
    await user.type(modal.getByRole("spinbutton"), "0");

    await user.click(modal.getByRole("button", { name: "Top-up" }));

    // Expect validation message (it doesn't close).
    expect(await modal.findByText(/Amount (must be > 0|is required)/)).toBeDefined();

    // Test export CSV
    // Mock URL.createObjectURL temporarily
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const exportBtn = screen.getByRole("button", { name: "Export Monthly Invoice" });
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

    // Cleanup mocks
    // @ts-expect-error - reset
    delete global.URL.createObjectURL;
    // @ts-expect-error - reset
    delete global.URL.revokeObjectURL;
  });

  it("renders mess accounts tab and performs a top-up", { timeout: 60000 }, async () => {
    renderPage();
    // Force the ledger sync offline so the local balance stands.
    global.fetch = vi.fn(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    // Click on the Mess Accounts tab
    const messTab = screen.getByRole("tab", { name: "Mess Accounts" });
    fireEvent.click(messTab);

    // Check that the Corporate Staff account is displayed
    expect(await screen.findByText("Corporate Staff")).toBeDefined();

    // Find the top-up button for the first account (Corporate Staff)
    const topUpButtons = await screen.findAllByRole("button", { name: "Top-up" });
    fireEvent.click(topUpButtons[0] as HTMLElement);

    // Scope to the modal dialog once mounted.
    const dialog = await screen.findByRole("dialog");
    const modal = within(dialog as HTMLElement);

    // Fill top-up modal
    fireEvent.change(modal.getByRole("spinbutton"), { target: { value: 1500 } });
    fireEvent.change(modal.getByPlaceholderText("e.g. Monthly allowance"), { target: { value: "Bonus" } });
    fireEvent.click(modal.getByRole("button", { name: "Top-up" }));

    // Verify balance updated: original 5000 + 1500 = 6500 (displayed as ₹6,500)
    expect(await screen.findByText("₹6,500")).toBeDefined();
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

  it("opens the customer profile drawer with activity timeline", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");
    const views = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(views[0] as HTMLElement);
    expect((await screen.findAllByText("+91 98200 11223")).length).toBe(2);
    expect(await screen.findByText("Activity Timeline")).toBeDefined();
    expect(await screen.findByText(/Most recent visit/)).toBeDefined();
  });

  it("filters the directory by tier and minimums", async () => {
    renderPage();
    await screen.findByText("Vikram Rao");
    fireEvent.click(screen.getByRole("radio", { name: "Gold" }));
    expect((await screen.findAllByText("Aarav Sharma")).length).toBe(2);
    expect(screen.queryByText("Vikram Rao")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Min orders"), { target: { value: 40 } });
    // Priya (36 orders) drops out of the table but stays in the unfiltered Top list
    expect((await screen.findAllByText("Priya Nair")).length).toBe(1);
    expect((await screen.findAllByText("Aarav Sharma")).length).toBe(2);
  });

  describe("avgRating helper", () => {
    it("should return 0 when feedbacks array is empty", () => {
      expect(avgRating([])).toBe(0);
    });

    it("should correctly calculate average rating", () => {
      const mockFeedbacks: Feedback[] = [
        { id: "1", customerName: "A", rating: 5, comment: "x", date: "y" },
        { id: "2", customerName: "B", rating: 4, comment: "x", date: "y" },
        { id: "3", customerName: "C", rating: 3, comment: "x", date: "y" },
      ];
      expect(avgRating(mockFeedbacks)).toBe(4);
    });
  });

  it("renders Feedback tab and verifies data", async () => {
    renderPage();

    // Go to Feedback tab
    const feedbackTab = screen.getByRole("tab", { name: "Feedback" });
    fireEvent.click(feedbackTab);

    expect(await screen.findByText("Customer Reviews")).toBeDefined();
    expect(await screen.findByText("Average Rating")).toBeDefined();

    expect((await screen.findByText("Average Rating")).parentElement?.textContent ?? "").toContain("4.2 / 5");

    expect(await screen.findByText("Excellent service and food quality!")).toBeDefined();
    expect(await screen.findByText("Average experience.")).toBeDefined();
  });
});
