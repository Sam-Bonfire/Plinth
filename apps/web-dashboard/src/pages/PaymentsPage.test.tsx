import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentsPage, buildPaymentsCsv } from "./PaymentsPage.js";

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

describe("buildPaymentsCsv", () => {
  it("generates correct CSV headers and data", () => {
    const rows = [
      {
        key: "TXN-1",
        id: "TXN-1",
        order: "ORD-1",
        method: "UPI" as const,
        channel: "Dine-in",
        amount: 500,
        time: "12:00",
        status: "Settled" as const,
      },
    ];
    const csv = buildPaymentsCsv(rows);
    expect(csv).toBe("date,method,amount,status,reference\n12:00,UPI,500,Settled,TXN-1");
  });

  it("escapes fields containing commas, quotes, or newlines", () => {
    const rows = [
      {
        key: "TXN-2",
        id: 'TXN-2, "VIP"',
        order: "ORD-2\nNew",
        method: "Cash" as const,
        channel: "Takeaway",
        amount: 250.5,
        time: "12:30",
        status: "Pending" as const,
      },
    ];
    const csv = buildPaymentsCsv(rows);
    expect(csv).toBe(
      'date,method,amount,status,reference\n12:30,Cash,250.5,Pending,"TXN-2, ""VIP"""'
    );
  });
});

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

  it("exports only filtered rows", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    // Memory says: use vi.spyOn(document, 'createElement') and fall back to original for untargeted elements
    const originalCreateElement = document.createElement.bind(document);
    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;

    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return mockAnchor;
      }
      return originalCreateElement(tagName);
    });

    renderPage();
    await screen.findByText("TXN-9001");

    // Filter to Cash only
    const filters = screen.getAllByRole("radiogroup");
    const methodInputs = within(filters[0] as HTMLElement).getAllByRole("radio");
    fireEvent.click(methodInputs[3] as HTMLElement);

    // Wait for the rows to be updated (TXN-9004 is Cash)
    expect(screen.queryByText("TXN-9001")).toBeNull();
    expect(await screen.findByText("TXN-9004")).toBeDefined();

    // Export the filtered rows
    // Use the small 'Export' button on the table
    const tableExport = screen.getByRole("button", { name: "Export" });
    fireEvent.click(tableExport);

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blobArg.type).toBe("text/csv");

    // The exported CSV should only contain Cash transactions
    const text = await blobArg.text();
    expect(text).toContain("TXN-9004");
    expect(text).not.toContain("TXN-9001");

    expect(mockAnchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    createElementSpy.mockRestore();
  });
});
