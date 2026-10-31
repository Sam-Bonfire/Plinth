import { PlinthThemeProvider } from "@plinth/ui-kit";
import type { PlinthApiClient } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { StaffPage, shiftHours, type AttendanceEntry } from "./StaffPage.js";

const mockAttendanceData = [
  { id: "ATT-1", staff_id: "ST-01", name: "Rajesh K", clock_in: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), clock_out: new Date().toISOString() },
  { id: "ATT-2", staff_id: "ST-02", name: "Meera S", clock_in: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), clock_out: null }
];

const mockAuthContext = {
  isAuthenticated: true,
  isRestoring: false,
  tenantId: "t1",
  locationId: "l1",
  login: async () => {},
  logout: () => {},
  client: {
    listStaff: async () => ({
      data: [
        { id: "ST-01", name: "Rajesh K", role: "Manager", location_id: "Koramangala", is_active: true },
        { id: "ST-02", name: "Meera S", role: "Cashier", location_id: "Koramangala", is_active: true }
      ]
    }),
    listAttendance: async () => ({
      data: mockAttendanceData
    }),
    getStaffPermissions: async () => ({
      roles: {
        Manager: 0b0000_0011_0111_1111,
        Cashier: 0b0000_0010_0000_0001
      }
    }),
    recordAttendance: async (req) => {
      if (req.action === "CLOCK_IN") {
        mockAttendanceData.push({
          id: `ATT-${Date.now()}`,
          staff_id: req.staff_id,
          name: req.staff_id,
          clock_in: new Date().toISOString(),
          clock_out: null
        });
      } else {
        const entry = mockAttendanceData.find(e => e.staff_id === req.staff_id && e.clock_out === null);
        if (entry) entry.clock_out = new Date().toISOString();
      }
    },
    ingestAudit: async () => {}
  } as unknown as PlinthApiClient,
};

function renderPage(): void {
  render(
    <AuthContext.Provider value={mockAuthContext}>
      <PlinthThemeProvider>
        <App>
          <StaffPage />
        </App>
      </PlinthThemeProvider>
    </AuthContext.Provider>,
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
  });

  it("adds a staff member through the modal", async () => {
    renderPage();
    await screen.findByText("Rajesh K");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Staff" }));
    fireEvent.change(await screen.findByPlaceholderText("Staff name"), { target: { value: "Kiran B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Kiran B")).toBeDefined();
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
