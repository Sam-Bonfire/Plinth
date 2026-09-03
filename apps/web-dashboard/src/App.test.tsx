import { LinguiProvider, PlinthThemeProvider } from "@plinth/ui-kit";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { AuthProvider } from "./providers/AuthProvider.js";

describe("Web Dashboard App", () => {
  it("renders login page", async () => {
    render(
      <MemoryRouter>
        <PlinthThemeProvider>
          <LinguiProvider>
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          </LinguiProvider>
        </PlinthThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/PlinthOS Login/)).toBeDefined();
  });

  it("renders dashboard page", async () => {
    render(
      <MemoryRouter>
        <PlinthThemeProvider>
          <LinguiProvider>
            <AuthProvider>
              <DashboardPage />
            </AuthProvider>
          </LinguiProvider>
        </PlinthThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Dashboard/)).toBeDefined();
  });

  it("renders placeholder pages", () => {
    render(<PlaceholderPage title="Menu Management" />);
    expect(screen.getByRole("heading", { name: /Menu Management/ })).toBeDefined();
  });
});
