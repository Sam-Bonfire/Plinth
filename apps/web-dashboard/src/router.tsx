import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "./components/Layout/AppLayout.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { useAuth } from "./providers/AuthProvider.js";

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/menu", element: <PlaceholderPage title="Menu Management" description="CRUD + 86 toggle + drag reorder via dnd-kit" /> },
          { path: "/inventory", element: <PlaceholderPage title="Inventory" description="Stock, recipes, par levels" /> },
          { path: "/reports", element: <PlaceholderPage title="Reports & Analytics" description="Sales, labor, tax with @ant-design/charts" /> },
          { path: "/staff", element: <PlaceholderPage title="Staff Management" description="Roles, permissions, PIN" /> },
          { path: "/floor", element: <PlaceholderPage title="Floor Plan" description="Tabular table editor" /> },
          { path: "/settings", element: <PlaceholderPage title="Settings" description="Tenant configuration" /> },
          { path: "/audit", element: <PlaceholderPage title="Audit Log" description="Immutable audit viewer" /> },
          { path: "/onboarding", element: <PlaceholderPage title="Onboarding Wizard" description="7-step setup flow" /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
