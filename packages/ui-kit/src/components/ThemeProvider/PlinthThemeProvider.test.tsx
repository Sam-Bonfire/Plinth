import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlinthThemeProvider, usePlinthTheme } from "./PlinthThemeProvider.js";

const TestConsumer = () => {
  const { isDark, toggleTheme, tokens } = usePlinthTheme();
  return (
    <div>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="token-bg">{tokens.bg}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};

describe("PlinthThemeProvider", () => {
  it("provides default light theme", () => {
    render(
      <PlinthThemeProvider>
        <TestConsumer />
      </PlinthThemeProvider>
    );

    expect(screen.getByTestId("is-dark").textContent).toBe("false");
    expect(screen.getByTestId("token-bg").textContent).toBe("#f4f5f4");
  });

  it("provides default dark theme if specified", () => {
    render(
      <PlinthThemeProvider defaultIsDark={true}>
        <TestConsumer />
      </PlinthThemeProvider>
    );

    expect(screen.getByTestId("is-dark").textContent).toBe("true");
  });

  it("toggles theme correctly", () => {
    render(
      <PlinthThemeProvider>
        <TestConsumer />
      </PlinthThemeProvider>
    );

    expect(screen.getByTestId("is-dark").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Toggle Theme" }));

    expect(screen.getByTestId("is-dark").textContent).toBe("true");
  });

  it("throws error if usePlinthTheme used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrowError(
      "usePlinthTheme must be used within a PlinthThemeProvider"
    );
    consoleError.mockRestore();
  });
});
