import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaffPage } from "./StaffPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <StaffPage />
    </PlinthThemeProvider>,
  );
}

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
});
