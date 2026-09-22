import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.js";
import { CheckoutPage } from "./pages/CheckoutPage.js";
import { PosProviders, usePosSession } from "./providers/PosProviders.js";
import { ShowcaseView } from "./showcase/ShowcaseView.js";

function RequireSession({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { session } = usePosSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const PosRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/showcase" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/checkout"
          element={
            <RequireSession>
              <CheckoutPage />
            </RequireSession>
          }
        />
        <Route
          path="/showcase"
          element={
            <RequireSession>
              <ShowcaseView scene="active-order" />
            </RequireSession>
          }
        />
        <Route path="*" element={<Navigate to="/showcase" replace />} />
      </Routes>
    </HashRouter>
  );
};

export const PosApp: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  return (
    <PosProviders isDark={isDark}>
      <PosRouter />
    </PosProviders>
  );
};
