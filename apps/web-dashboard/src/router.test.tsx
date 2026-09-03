import { PlinthThemeProvider, LinguiProvider } from "@plinth/ui-kit";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { AuthProvider } from "./providers/AuthProvider.js";

function renderWithProviders(router: ReturnType<typeof createMemoryRouter>): void {
  render(
    <PlinthThemeProvider>
      <LinguiProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </LinguiProvider>
    </PlinthThemeProvider>,
  );
}

describe("Dashboard Routing", () => {
  it("renders login page at /login", async () => {
    const router = createMemoryRouter([{ path: "/login", element: <LoginPage /> }], {
      initialEntries: ["/login"],
    });
    renderWithProviders(router);
    expect(await screen.findByText(/PlinthOS Login/)).toBeDefined();
  });

  it("renders dashboard page at /", async () => {
    const router = createMemoryRouter([{ path: "/", element: <DashboardPage /> }], {
      initialEntries: ["/"],
    });
    renderWithProviders(router);
    expect(await screen.findByText(/Dashboard/)).toBeDefined();
  });
});
