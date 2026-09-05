import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MenuPage } from "./MenuPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <MenuPage />
    </PlinthThemeProvider>,
  );
}

describe("MenuPage", () => {
  it("renders categories, items and counts", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "All Items · 6" })).toBeDefined();
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(await screen.findByText("6 items")).toBeDefined();
  });

  it("filters items by category", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    fireEvent.click(screen.getByRole("button", { name: /Beverages/ }));
    expect(await screen.findByText("Mango Lassi")).toBeDefined();
    expect(screen.queryByText("Butter Chicken")).toBeNull();
  });

  it("toggles an item to 86'd", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    expect(screen.getAllByRole("switch", { checked: true }).length).toBe(5);
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0] as HTMLElement);
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
    expect(screen.getAllByRole("switch", { checked: true }).length).toBe(4);
  });

  it("adds a new item through the modal", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
    fireEvent.change(await screen.findByPlaceholderText("Item name"), { target: { value: "Masala Dosa" } });
    fireEvent.change(await screen.findByPlaceholderText("Price"), { target: { value: "140" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Masala Dosa")).toBeDefined();
  }, 15000);

  it("deletes an item through the confirm popover", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    const deletes = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deletes[0] as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(screen.queryByText("Butter Chicken")).toBeNull();
  }, 15000);
});
