import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "./components/Layout/AppLayout.js";
import { CustomersPage } from "./pages/CustomersPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { InventoryPage } from "./pages/InventoryPage.js";
import { KitchenPage } from "./pages/KitchenPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MenuPage } from "./pages/MenuPage.js";
import { OrdersPage } from "./pages/OrdersPage.js";
import { PaymentsPage } from "./pages/PaymentsPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";
import { PosPage } from "./pages/PosPage.js";
import { ReportsPage } from "./pages/ReportsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { StaffPage } from "./pages/StaffPage.js";
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
          { path: "/", element: <Navigate to="/pos" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/pos", element: <PosPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/kitchen", element: <KitchenPage /> },
          { path: "/payments", element: <PaymentsPage /> },
          { path: "/menu", element: <MenuPage /> },
          { path: "/inventory", element: <InventoryPage /> },
          { path: "/customers", element: <CustomersPage /> },
          { path: "/staff", element: <StaffPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/floor", element: <PlaceholderPage title="Floor Plan" description="Tabular table editor" /> },
          { path: "/audit", element: <PlaceholderPage title="Audit Log" description="Immutable audit viewer" /> },
          { path: "/onboarding", element: <PlaceholderPage title="Onboarding Wizard" description="7-step setup flow" /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
