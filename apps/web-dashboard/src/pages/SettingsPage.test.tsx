import { PlinthThemeProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SettingsPage, loadSettings, saveSettings, seedLocations } from "./SettingsPage.js";

function renderPage(): void {
  render(
    <PlinthThemeProvider>
      <SettingsPage />
    </PlinthThemeProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadSettings returns defaults when localStorage is empty", () => {
    const settings = loadSettings();
    expect(settings.values.general.currency).toBe("INR");
    expect(settings.locations).toEqual(seedLocations());
  });

  it("loadSettings and saveSettings round-trip values successfully", () => {
    const defaults = loadSettings();
    const updatedValues = {
      ...defaults.values,
      general: { ...defaults.values.general, currency: "USD", darkMode: true },
    };
    saveSettings({ values: updatedValues, locations: defaults.locations });

    const loaded = loadSettings();
    expect(loaded.values.general.currency).toBe("USD");
    expect(loaded.values.general.darkMode).toBe(true);
  });

  it("loadSettings recovers from corrupt JSON strings gracefully by falling back to defaults", () => {
    localStorage.setItem("plinth-settings", "{ bad json ");
    const settings = loadSettings();
    expect(settings.values.general.currency).toBe("INR");
  });

  it("loadSettings recovers from malformed objects gracefully by falling back to defaults", () => {
    localStorage.setItem("plinth-settings", JSON.stringify({ values: { general: { currency: { complex: true } } } }));
    const settings = loadSettings();
    expect(settings.values.general.currency).toBe("INR");
  });

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
