import { PlinthThemeProvider, LinguiProvider } from "@plinth/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { AppLayout } from "./components/Layout/AppLayout.js";
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

  it("renders grouped nav and contextual topbar on /pos", async () => {
    renderShellAt("/pos");
    expect(await screen.findByText("Operations")).toBeDefined();
    expect(await screen.findByText("Management")).toBeDefined();
    expect(await screen.findByText("Analytics")).toBeDefined();
    expect(await screen.findByText("POS — Order Entry")).toBeDefined();
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
    expect(await screen.findByRole("heading", { name: "Kitchen" })).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /Koramangala/ }));
    expect(await screen.findByRole("button", { name: /Indiranagar/ })).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /End of Day/ }));
    expect(await screen.findByText("Shift reconciliation")).toBeDefined();
  });
});
