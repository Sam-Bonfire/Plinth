import { PlinthThemeProvider } from "@plinth/ui-kit";
import React from "react";
import { PosSessionProvider, usePosSession } from "./PosSessionProvider.js";

export { usePosSession };

export const PosProviders: React.FC<{ children: React.ReactNode; isDark?: boolean }> = ({
  children,
  isDark = false,
}) => {
  return (
    <PlinthThemeProvider overrideIsDark={isDark}>
      <PosSessionProvider>{children}</PosSessionProvider>
    </PlinthThemeProvider>
  );
};
