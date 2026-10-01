import { Typography } from "antd";
import React from "react";
import { createBrowserRouter, Link, Navigate, Outlet, useRouteError } from "react-router-dom";
import { AppLayout } from "./components/Layout/AppLayout.js";
import { AuditLogPage } from "./pages/AuditLogPage.js";
import { CustomersPage } from "./pages/CustomersPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { InventoryPage } from "./pages/InventoryPage.js";
import { KitchenPage } from "./pages/KitchenPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MenuPage } from "./pages/MenuPage.js";
import { OnboardingWizard } from "./pages/OnboardingWizard.js";
import { OrdersPage } from "./pages/OrdersPage.js";
import { PaymentsPage } from "./pages/PaymentsPage.js";
import { PosPage } from "./pages/PosPage.js";
import { RecipesPage } from "./pages/RecipesPage.js";
import { ReportsPage } from "./pages/ReportsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { StaffPage } from "./pages/StaffPage.js";
import { TablesPage } from "./pages/TablesPage.js";
import { TrackingPage } from "./pages/TrackingPage.js";
import { VendorsPage } from "./pages/VendorsPage.js";
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
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/pos", element: <PosPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/tracking", element: <TrackingPage /> },
          { path: "/kitchen", element: <KitchenPage /> },
          { path: "/payments", element: <PaymentsPage /> },
          { path: "/menu", element: <MenuPage /> },
          { path: "/inventory", element: <InventoryPage /> },
          { path: "/recipes", element: <RecipesPage /> },
          { path: "/customers", element: <CustomersPage /> },
          { path: "/vendors", element: <VendorsPage /> },
          { path: "/staff", element: <StaffPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/floor", element: <TablesPage /> },
          { path: "/audit", element: <AuditLogPage /> },
          { path: "/onboarding", element: <OnboardingWizard /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
