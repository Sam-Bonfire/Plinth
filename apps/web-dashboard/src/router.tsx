import { Typography } from "antd";
import React from "react";
import { createBrowserRouter, Link, Navigate, Outlet, useRouteError } from "react-router-dom";
import { AppLayout } from "./components/Layout/AppLayout.js";
import { CustomersPage } from "./pages/CustomersPage.js";
import { InventoryPage } from "./pages/InventoryPage.js";
import { KitchenPage } from "./pages/KitchenPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MenuPage } from "./pages/MenuPage.js";
import { OnboardingWizard } from "./pages/OnboardingWizard.js";
import { OrdersPage } from "./pages/OrdersPage.js";
import { PaymentsPage } from "./pages/PaymentsPage.js";
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

export const NotFoundPage: React.FC = () => {
  const error = useRouteError() as { statusText?: string; message?: string } | null;
  return (
    <main style={{ padding: 48, textAlign: "center" }}>
      <Typography.Title level={1}>Page not found</Typography.Title>
      <Typography.Paragraph type="secondary">
        {error?.statusText ?? error?.message ?? "The page you asked for does not exist."}
      </Typography.Paragraph>
      <Link to="/pos">Back to POS</Link>
    </main>
  );
};

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <NotFoundPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <NotFoundPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Navigate to="/pos" replace /> },
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
          { path: "/onboarding", element: <OnboardingWizard /> },
          // Legacy aliases folded into the prototype IA (one release, then drop).
          { path: "/dashboard", element: <Navigate to="/reports" replace /> },
          { path: "/tracking", element: <Navigate to="/orders" replace /> },
          { path: "/recipes", element: <Navigate to="/inventory" replace /> },
          { path: "/vendors", element: <Navigate to="/inventory" replace /> },
          { path: "/floor", element: <Navigate to="/settings" replace /> },
          { path: "/audit", element: <Navigate to="/staff" replace /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
