import { BusinessConfigProvider, LinguiProvider, PlinthThemeProvider } from "@plinth/ui-kit";
import React from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "./providers/AuthProvider.js";
import { router } from "./router.js";

// The config endpoint needs the authenticated client, so this mounts inside AuthProvider.
const ConfigScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { client } = useAuth();
  return <BusinessConfigProvider client={client}>{children}</BusinessConfigProvider>;
};

const App: React.FC = () => {
  const defaultIsDark = localStorage.getItem("plinth-theme") === "dark";

  return (
    <PlinthThemeProvider defaultIsDark={defaultIsDark}>
      <LinguiProvider>
        <AuthProvider>
          <ConfigScope>
            <RouterProvider router={router} />
          </ConfigScope>
        </AuthProvider>
      </LinguiProvider>
    </PlinthThemeProvider>
  );
};

export default App;
