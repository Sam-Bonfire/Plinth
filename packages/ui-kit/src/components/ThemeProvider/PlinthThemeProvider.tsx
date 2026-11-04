import type { ThemeConfig } from "antd";
import { ConfigProvider, theme } from "antd";
import React, { createContext, ReactNode, useContext, useState, useMemo, useEffect } from "react";
import { TOKENS_BY_MODE, Tokens } from "../../tokens.js";

const THEME_STORAGE_KEY = "plinth-theme";

const getThemeConfig = (isDark: boolean, tokens: Tokens): ThemeConfig => ({
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: tokens.acc,
    colorBorder: tokens.b1,
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: tokens.font,
    fontFamilyCode: tokens.mono,
  },
  components: {
    Button: {
      colorPrimary: tokens.acc,
      colorBorder: tokens.b1,
    },
    Input: {
      colorPrimary: tokens.acc,
      colorBorder: tokens.b1,
    },
    Select: {
      colorPrimary: tokens.acc,
      colorBorder: tokens.b1,
    },
    Tabs: {
      colorPrimary: tokens.acc,
    },
    Table: {
      headerColor: tokens.s2,
      headerBg: tokens.b1,
      headerSplitColor: "transparent",
      colorSplit: tokens.b1,
      controlItemBgHover: "transparent",
      headerFilterHoverBg: "transparent",
      rowHoverBg: tokens.s2,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      borderRadius: 8,
    },
    Pagination: {
      itemBg: "transparent",
      itemActiveBg: tokens.b1,
      colorText: tokens.acc,
      colorPrimary: tokens.acc,
      borderRadius: 4,
    },
    Checkbox: {
      colorPrimary: tokens.acc,
      borderRadiusSM: 2,
    },
    Radio: {
      colorPrimary: tokens.acc,
    },
    Drawer: {
      colorBgElevated: tokens.bg,
    },
    Modal: {
      colorBgElevated: tokens.bg,
    },
  },
});

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
  overrideIsDark?: boolean;
}

const getStoredIsDark = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark";
};

const applyRootVariables = (isDark: boolean): void => {
  if (typeof window === "undefined") return;
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  const tokens = TOKENS_BY_MODE[isDark ? "dark" : "light"];
  for (const [key, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(`--${key}`, value);
  }
};

// First-paint inline setup to prevent flashing. This runs once when the module loads,
// which is typically before React mounts the app.
if (typeof window !== "undefined") {
  const isDark = getStoredIsDark();
  applyRootVariables(isDark);
}

export const PlinthThemeProvider: React.FC<PlinthThemeProviderProps> = ({
  children,
  overrideIsDark,
}) => {
  const [internalIsDark, setInternalIsDark] = useState(getStoredIsDark);

  const isDark = overrideIsDark ?? internalIsDark;
  const currentTokens = TOKENS_BY_MODE[isDark ? "dark" : "light"];

  const toggleTheme = () => {
    if (overrideIsDark === undefined) {
      setInternalIsDark((prev) => {
        const next = !prev;
        localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
        return next;
      });
    }
  };

  useEffect(() => {
    // Only apply data-theme and CSS vars to root if we are the main provider
    // and not overridden.
    if (overrideIsDark === undefined) {
      applyRootVariables(isDark);
    }
  }, [isDark, overrideIsDark]);

  const cssVariables = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(currentTokens)) {
      vars[`--${key}`] = value;
    }
    return vars;
  }, [currentTokens]);

  const contextValue = useMemo(
    () => ({
      isDark,
      toggleTheme,
      tokens: currentTokens,
    }),
    [isDark, currentTokens]
  );

  return (
    <PlinthThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={getThemeConfig(isDark, currentTokens)}>
        <div
          data-theme={isDark ? "dark" : "light"}
          style={overrideIsDark !== undefined ? { display: "contents", ...cssVariables } as React.CSSProperties : { display: "contents" }}
        >
          {children}
        </div>
      </ConfigProvider>
    </PlinthThemeContext.Provider>
  );
};
