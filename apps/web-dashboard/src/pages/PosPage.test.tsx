import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PosPage } from "./PosPage.js";

function renderPage(): HTMLElement {
  const { container } = render(
    <PlinthThemeProvider>
      <PosPage />
    </PlinthThemeProvider>,
  );
  return container;
}

describe("PosPage", () => {
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
    expect(await screen.findByText(/placed/)).toBeDefined();
    expect(await screen.findByText("Order #4428")).toBeDefined();
  });
});
