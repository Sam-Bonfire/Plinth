import { LinguiProvider, PlinthThemeProvider } from "@plinth/ui-kit";
import React from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./providers/AuthProvider.js";
import { router } from "./router.js";

const App: React.FC = () => {
  const defaultIsDark = localStorage.getItem("plinth-theme") === "dark";

  return (
    <PlinthThemeProvider defaultIsDark={defaultIsDark}>
      <LinguiProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </LinguiProvider>
    </PlinthThemeProvider>
  );
};

export default App;
