import { PlinthThemeProvider, LinguiProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { AppLayout } from "./components/Layout/AppLayout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { AuthProvider } from "./providers/AuthProvider.js";
import { NotFoundPage } from "./router.js";

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

describe("App Shell", () => {
  function renderShellAt(path: string): void {
    const router = createMemoryRouter(
      [
        {
          element: <AppLayout />,
          children: [{ path, element: <div>body</div> }],
        },
      ],
      { initialEntries: [path] },
    );
    renderWithProviders(router);
  }

  it("renders prototype nav (10 items) and contextual topbar on /pos", async () => {
    renderShellAt("/pos");
    expect(await screen.findByText("Operations")).toBeDefined();
    expect(await screen.findByText("Management")).toBeDefined();
    expect(await screen.findByText("Analytics")).toBeDefined();
    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeDefined();
    expect(await screen.findByRole("link", { name: "Skip to content" })).toBeDefined();
    // Prototype titles/subs
    expect(await screen.findByRole("heading", { level: 1, name: "POS — Order Entry" })).toBeDefined();
    expect(await screen.findByText("Category · Item · Modifier · Pay")).toBeDefined();
    // Prototype nav has 10 items; extras (Tracking/Recipes/Vendors/Audit Log) stay out of the nav
    expect(screen.queryByRole("menuitem", { name: "Tracking" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Recipes" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Vendors" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Audit Log" })).toBeNull();
    expect(await screen.findByRole("button", { name: /Simulate Offline/ })).toBeDefined();
    expect(await screen.findByRole("button", { name: /End of Day/ })).toBeDefined();
    expect(await screen.findByRole("button", { name: /New Order/ })).toBeDefined();
  });

  it("toggles offline mode from the topbar", async () => {
    renderShellAt("/orders");
    expect(await screen.findByText("All systems live")).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /Simulate Offline/ }));
    expect(await screen.findByText("Offline mode")).toBeDefined();
    expect(await screen.findByRole("button", { name: /Go Online/ })).toBeDefined();
  });

  it("cycles outlet and opens the End of Day modal", async () => {
    renderShellAt("/kitchen");
    expect(await screen.findByRole("heading", { level: 1, name: "Kitchen Display" })).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /Koramangala/ }));
    expect(await screen.findByRole("button", { name: /Indiranagar/ })).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /End of Day/ }));
    expect(await screen.findByText("Shift reconciliation")).toBeDefined();
  });

  it("renders the 404 page for unknown routes", async () => {
    const router = createMemoryRouter([{ path: "*", element: <NotFoundPage /> }], {
      initialEntries: ["/nope"],
    });
    renderWithProviders(router);
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeDefined();
    expect(await screen.findByRole("link", { name: "Back to POS" })).toBeDefined();
  });
});
