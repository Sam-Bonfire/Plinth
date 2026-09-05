import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrdersPage } from "./OrdersPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <OrdersPage />
    </PlinthThemeProvider>,
  );
}

describe("OrdersPage", () => {
  it("renders seeded orders with channel and status badges", async () => {
    renderPage();
    expect(await screen.findByText("ORD-1098")).toBeDefined();
    expect(await screen.findByText("SW-9921")).toBeDefined();
    expect(await screen.findByTestId("channel-badge-dinein")).toBeDefined();
    expect((await screen.findAllByTestId("status-badge-preparing")).length).toBeGreaterThan(0);
  });

  it("filters by channel", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const filters = screen.getAllByRole("radiogroup");
    const channelInputs = within(filters[1] as HTMLElement).getAllByRole("radio");
    fireEvent.click(channelInputs[3] as HTMLElement);
    expect(await screen.findByText("SW-9921")).toBeDefined();
    expect(screen.queryByText("ORD-1098")).toBeNull();
  });

  it("advances an order to the next status", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const advances = screen.getAllByRole("button", { name: "Advance" });
    fireEvent.click(advances[0] as HTMLElement);
    expect(await screen.findByTestId("status-badge-ready")).toBeDefined();
  });

  it("voids an order through the confirm popover", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const voids = screen.getAllByRole("button", { name: "Void" });
    fireEvent.click(voids[0] as HTMLElement);
    expect(await screen.findByText("Void this order?")).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(await screen.findByTestId("status-badge-voided")).toBeDefined();
  });

  it("opens the order detail modal", async () => {
    renderPage();
    await screen.findByText("ORD-1098");
    const views = screen.getAllByRole("button", { name: "View" });
    fireEvent.click(views[0] as HTMLElement);
    expect(await screen.findByText("Butter Chicken")).toBeDefined();
  });
});
