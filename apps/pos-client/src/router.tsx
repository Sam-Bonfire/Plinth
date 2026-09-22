import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { PosProviders } from "./providers/PosProviders.js";
import { ShowcaseView } from "./showcase/ShowcaseView.js";

export const PosRouter: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/showcase" replace />} />
        <Route path="/showcase" element={<ShowcaseView scene="active-order" />} />
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
