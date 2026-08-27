import { ConfigProvider } from "antd";
import React, { createContext, ReactNode, useContext, useState, useMemo } from "react";
import { getThemeConfig } from "../../index.js";
import { TOKENS, Tokens } from "../../tokens.js";

export interface PlinthThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  tokens: Tokens;
}

const PlinthThemeContext = createContext<PlinthThemeContextType | undefined>(undefined);

export const usePlinthTheme = (): PlinthThemeContextType => {
  const context = useContext(PlinthThemeContext);
  if (!context) {
    throw new Error("usePlinthTheme must be used within a PlinthThemeProvider");
  }
  return context;
};

export interface PlinthThemeProviderProps {
  children: ReactNode;
  defaultIsDark?: boolean;
}

export const PlinthThemeProvider: React.FC<PlinthThemeProviderProps> = ({
  children,
  defaultIsDark = false,
}) => {
  const [isDark, setIsDark] = useState(defaultIsDark);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const contextValue = useMemo(
    () => ({
      isDark,
      toggleTheme,
      tokens: TOKENS,
    }),
    [isDark]
  );

  return (
    <PlinthThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={getThemeConfig(isDark)}>
        {children}
      </ConfigProvider>
    </PlinthThemeContext.Provider>
  );
};
