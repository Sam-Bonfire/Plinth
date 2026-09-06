import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "./SettingsPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <SettingsPage />
    </PlinthThemeProvider>,
  );
}

describe("SettingsPage", () => {
  it("renders the settings nav with the general tab", async () => {
    renderPage();
    expect(await screen.findByText("Offline Config")).toBeDefined();
    expect(await screen.findByText("Restaurant name")).toBeDefined();
  });

  it("switches to the devices tab", async () => {
    renderPage();
    await screen.findByText("Restaurant name");
    fireEvent.click(screen.getByRole("menuitem", { name: "Devices" }));
    expect(await screen.findByText("KDS refresh interval")).toBeDefined();
  });

  it("saves tab settings", async () => {
    renderPage();
    await screen.findByText("Restaurant name");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Settings saved.")).toBeDefined();
  });

  it("adds a location through the modal", async () => {
    renderPage();
    await screen.findByText("Restaurant name");
    fireEvent.click(screen.getByRole("menuitem", { name: "Locations" }));
    expect(await screen.findByText("Koramangala")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "+ Add Location" }));
    fireEvent.change(await screen.findByPlaceholderText("Location name"), { target: { value: "Whitefield" } });
    fireEvent.change(await screen.findByPlaceholderText("City"), { target: { value: "Bengaluru" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Whitefield")).toBeDefined();
  });
});
