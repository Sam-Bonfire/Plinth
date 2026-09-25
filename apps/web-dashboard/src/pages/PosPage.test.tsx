import { PlinthThemeProvider } from "@plinth/ui-kit";
import type { PlinthApiClient } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { useCartStore } from "../stores/cartStore.js";
import { PosPage, tenderChange, validateTender } from "./PosPage.js";

const mockAuthContext = {
  isAuthenticated: true,
  tenantId: "t1",
  locationId: "l1",
  login: async () => {},
  logout: () => {},
  client: { ingestAudit: async () => {} } as unknown as PlinthApiClient,
};

function renderPage(): HTMLElement {
  const { container } = render(
    <AuthContext.Provider value={mockAuthContext}>
      <PlinthThemeProvider>
        <PosPage />
      </PlinthThemeProvider>
    </AuthContext.Provider>,
  );
  return container;
}

describe("PosPage", () => {
  beforeEach(() => {
    useCartStore.getState().reset();
  });

  it("renders the menu with availability states", async () => {
    renderPage();
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByText("Mango Lassi")).toBeDefined();
    expect(await screen.findByText("86'd")).toBeDefined();
  });

  it("adds a modifier-free item straight to the cart", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Mango Lassi"));
    expect(await screen.findByText("₹123.20")).toBeDefined();
  });

  it("adds an item through the modifier modal", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Butter Chicken"));
    const full = document.querySelector('input[value="Full"]');
    const spicy = document.querySelector('input[value="Spicy"]');
    expect(full).not.toBeNull();
    expect(spicy).not.toBeNull();
    fireEvent.click(full as HTMLElement);
    fireEvent.click(spicy as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: /Add to Order/ }));
    expect(await screen.findByText("Full · Spicy")).toBeDefined();
  });

  it("warns on empty checkout and confirms a placed order", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Place Order/ }));
    expect(await screen.findByText(/Cart is empty/)).toBeDefined();
    fireEvent.click(await screen.findByText("Mango Lassi"));
    fireEvent.click(await screen.findByRole("button", { name: /Place Order/ }));
    expect(await screen.findByText(/Tender/)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /Confirm Payment/ }));
    expect(await screen.findByText(/Order #\d+ settled/)).toBeDefined();
  });

  it("computes change and blocks under-tendered cash", () => {
    expect(tenderChange(100, 150)).toBe(50);
    expect(validateTender("Cash", 100, 150)).toBeNull();
    expect(validateTender("Cash", 100, 60)).toContain("Short by");
    expect(validateTender("Cash", 100, null)).toContain("Enter the cash tendered");
    expect(validateTender("UPI", 100, null)).toBeNull();
  });

  it("shows change due after a cash tender", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Mango Lassi"));
    fireEvent.click(screen.getByRole("radio", { name: "Cash" }));
    fireEvent.click(await screen.findByRole("button", { name: /Place Order/ }));
    const tendered = screen.getByPlaceholderText("Cash tendered");
    fireEvent.change(tendered, { target: { value: 200 } });
    expect(await screen.findByText(/Change:/)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /Confirm Payment/ }));
    expect(await screen.findByText(/Change due:/)).toBeDefined();
  }, 60000);
});
