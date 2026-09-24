import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi } from "vitest";
import { StaffPage, shiftHours, type AttendanceEntry } from "./StaffPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <App>
        <StaffPage />
      </App>
    </PlinthThemeProvider>,
  );
}

describe("shiftHours", () => {
  it("computes normal completed shifts correctly", () => {
    const entries: AttendanceEntry[] = [
      { key: "1", staffKey: "s1", name: "Bob", clockIn: new Date(1000 * 60 * 60).toISOString(), clockOut: new Date(1000 * 60 * 60 * 4).toISOString() }
    ];
    expect(shiftHours(entries)).toBe(3);
  });

  it("handles missing-out shifts by using nowMs", () => {
    const entries: AttendanceEntry[] = [
      { key: "1", staffKey: "s1", name: "Bob", clockIn: new Date(1000 * 60 * 60).toISOString(), clockOut: null }
    ];
    const now = 1000 * 60 * 60 * 5;
    expect(shiftHours(entries, now)).toBe(4);
  });

  it("handles overnight/long shifts correctly", () => {
    const entries: AttendanceEntry[] = [
      { key: "1", staffKey: "s1", name: "Bob", clockIn: new Date(1000 * 60 * 60 * 20).toISOString(), clockOut: new Date(1000 * 60 * 60 * 26).toISOString() }
    ];
    expect(shiftHours(entries)).toBe(6);
  });
});

describe("StaffPage", () => {
  it("renders the staff list with role badges", async () => {
    renderPage();
    expect(await screen.findByText("Rajesh K")).toBeDefined();
    expect(await screen.findByText("Manager")).toBeDefined();
    expect(await screen.findByRole("tab", { name: "Permissions" })).toBeDefined();
    expect(await screen.findByRole("tab", { name: "Audit Log" })).toBeDefined();
  });

  it("adds a staff member through the modal", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Staff" }));
    fireEvent.change(await screen.findByPlaceholderText("Staff name"), { target: { value: "Kiran B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Kiran B")).toBeDefined();
  });

  it("toggles a permission and saves the matrix", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: "Permissions" }));
    expect(await screen.findByText("Role Permissions Matrix")).toBeDefined();
    const boxes = screen.getAllByRole("checkbox");
    const before = boxes.filter((b) => (b as HTMLInputElement).checked).length;
    fireEvent.click(boxes[0] as HTMLElement);
    const after = screen.getAllByRole("checkbox").filter((b) => (b as HTMLInputElement).checked).length;
    expect(after).toBe(before - 1);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Role permissions saved.")).toBeDefined();
  }, 30000);

  it("queues the matrix for terminal sync", async () => {
    localStorage.clear();
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: "Permissions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sync to Terminals" }));
    expect(await screen.findByText(/queued for terminal sync \(1 pending\)/)).toBeDefined();
    localStorage.clear();
  }, 30000);

  it("filters the audit log by action", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: "Audit Log" }));
    expect(await screen.findByText("Discount 10%")).toBeDefined();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Logins"));
    expect(await screen.findByText("Login")).toBeDefined();
    expect(screen.queryByText("Discount 10%")).toBeNull();
  });

  it("submits and approves an escalation request", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: /Escalations/ }));
    expect(await screen.findByText("No escalation requests.")).toBeDefined();
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0] as HTMLElement);
    fireEvent.click(await screen.findByText("Meera S · Cashier"));
    fireEvent.change(screen.getByPlaceholderText("Reason for escalation…"), {
      target: { value: "Shift lead duties" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Submit Request" }));
    expect(await screen.findByText("Shift lead duties")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approved")).toBeDefined();
  });

  it("exports filtered audit log to CSV", async () => {
    const mockCreateObjectUrl = vi.fn().mockReturnValue("blob:test-url");
    const mockRevokeObjectUrl = vi.fn();
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const mockCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: mockClick,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });

    global.URL.createObjectURL = mockCreateObjectUrl;
    global.URL.revokeObjectURL = mockRevokeObjectUrl;

    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: "Audit Log" }));

    // Filter to just Logins
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Logins"));
    expect(await screen.findByText("Login")).toBeDefined();

    // Export
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(mockCreateObjectUrl).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectUrl).toHaveBeenCalledWith("blob:test-url");

    // Ensure Blob contains only Logins
    const blobArg = mockCreateObjectUrl.mock.calls[0][0] as Blob;
    const csvContent = await blobArg.text();
    expect(csvContent).toContain("PIN"); // value from the login row
    expect(csvContent).not.toContain("Discount 10%");

    mockCreateElement.mockRestore();
  });

  it("handles clocking in and out via the Attendance tab", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("tab", { name: "Attendance" }));
    expect(await screen.findByText("Clock In / Clock Out")).toBeDefined();

    const clockInButtons = screen.getAllByRole("button", { name: "Clock In" });
    expect(clockInButtons.length).toBeGreaterThan(0);
    const firstClockIn = clockInButtons[0] as HTMLButtonElement;
    expect(firstClockIn.disabled).toBe(false);

    fireEvent.click(firstClockIn);
    expect(await screen.findByText(/clocked in/i)).toBeDefined();

    // Now it should be disabled
    expect(firstClockIn.disabled).toBe(true);

    const clockOutButtons = screen.getAllByRole("button", { name: "Clock Out" });
    const matchingClockOut = clockOutButtons[0] as HTMLButtonElement;

    fireEvent.click(matchingClockOut);
    expect(await screen.findByText(/clocked out/i)).toBeDefined();
  });
});
