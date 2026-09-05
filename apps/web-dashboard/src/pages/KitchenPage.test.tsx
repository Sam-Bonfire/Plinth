import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KitchenPage } from "./KitchenPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <KitchenPage />
    </PlinthThemeProvider>,
  );
}

describe("KitchenPage", () => {
  it("renders station columns with seeded tickets", async () => {
    renderPage();
    expect(await screen.findByText(/Main Kitchen/)).toBeDefined();
    expect(await screen.findByText("#42")).toBeDefined();
    expect(await screen.findByText("14:00")).toBeDefined();
  });

  it("bumps a ticket off the board", async () => {
    renderPage();
    await screen.findByText("#42");
    const bumps = screen.getAllByRole("button", { name: "BUMP" });
    fireEvent.click(bumps[0] as HTMLElement);
    expect(await screen.findByText(/bumped/)).toBeDefined();
    expect(screen.queryByText("#42")).toBeNull();
  });

  it("injects a test order onto the board", async () => {
    renderPage();
    await screen.findByText("#42");
    fireEvent.click(await screen.findByRole("button", { name: /Inject Test Order/ }));
    expect(await screen.findByText("#45")).toBeDefined();
  });
});
