import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/AuthProvider.js";
import { MenuPage, DeleteConfirm } from "./MenuPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <AuthProvider>
        <MenuPage />
      </AuthProvider>
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
  }, 60000);

  it("deletes an item through the confirm popover", async () => {
    renderPage();
    await screen.findByText("Butter Chicken");
    const deletes = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deletes[0] as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(screen.queryByText("Butter Chicken")).toBeNull();
  }, 60000);

  it("queues a menu sync with item count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ success: true, runs: [{ id: "r-1", platform: "Swiggy", status: "queued" }] }),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByText("Butter Chicken");
    fireEvent.click(screen.getByRole("button", { name: "Sync" }));
    expect(await screen.findByText(/Menu sync queued/)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/menu/sync"),
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  }, 60000);
});


describe("DeleteConfirm", () => {
  it("allows delete when blockedBy is undefined", () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirm itemName="TestItem" onConfirm={onConfirm} />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("blocks delete when blockedBy has items", async () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirm itemName="TestItem" onConfirm={onConfirm} blockedBy={["Order #1", "Ticket #5"]} />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.hasAttribute("disabled")).toBe(true);

    // Simulate hover to trigger tooltip
    fireEvent.mouseEnter(button.parentElement!);
    const tooltipContent = await screen.findByText(/Cannot delete: active references/i);
    expect(tooltipContent).toBeDefined();
  });
});
