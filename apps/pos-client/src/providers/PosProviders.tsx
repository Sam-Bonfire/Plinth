import { getThemeConfig } from "@plinth/ui-kit";
import { ConfigProvider } from "antd";
import React from "react";
import { PosSessionProvider, usePosSession } from "./PosSessionProvider.js";

export { usePosSession };

export const PosProviders: React.FC<{ children: React.ReactNode; isDark?: boolean }> = ({
  children,
  isDark = false,
}) => {
  return (
    <ConfigProvider theme={getThemeConfig(isDark)}>
      <PosSessionProvider>{children}</PosSessionProvider>
    </ConfigProvider>
  );
};
