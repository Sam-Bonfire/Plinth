import { ConfigProvider } from "antd";
import React, { ReactNode } from "react";
import { getThemeConfig } from "../index.js";

export interface PlinthThemeProviderProps {
  children: ReactNode;
  isDark?: boolean;
}

export const PlinthThemeProvider: React.FC<PlinthThemeProviderProps> = ({
  children,
  isDark = false,
}) => {
  return (
    <ConfigProvider theme={getThemeConfig(isDark)}>
      {children}
    </ConfigProvider>
  );
};
