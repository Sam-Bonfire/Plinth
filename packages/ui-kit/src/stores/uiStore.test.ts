import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore, getIsDark } from "./uiStore.js";

describe("UiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      themeMode: "light",
      locale: "en",
      sidebarCollapsed: false,
      isDarkResolved: false,
    });
  });

  it("sets theme mode and resolves dark correctly", () => {
    useUiStore.getState().setThemeMode("dark");
    expect(useUiStore.getState().themeMode).toBe("dark");
    expect(getIsDark("dark", false)).toBe(true);
    expect(getIsDark("light", true)).toBe(false);
    expect(getIsDark("system", true)).toBe(true);
    expect(getIsDark("system", false)).toBe(false);
  });

  it("toggles locale", () => {
    useUiStore.getState().setLocale("hi");
    expect(useUiStore.getState().locale).toBe("hi");
  });

  it("toggles sidebar collapsed", () => {
    const initial = useUiStore.getState().sidebarCollapsed;
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(!initial);
    useUiStore.getState().setSidebarCollapsed(false);
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("sets dark resolved flag", () => {
    useUiStore.getState().setDarkResolved(true);
    expect(useUiStore.getState().isDarkResolved).toBe(true);
  });
});
