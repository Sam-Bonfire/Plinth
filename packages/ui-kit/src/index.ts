import type { ThemeConfig } from "antd";
import { theme } from "antd";
import "./tokens.css";

export * from "./tokens.js";

export const getThemeConfig = (isDark: boolean): ThemeConfig => ({
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: "var(--acc)",
    colorBorder: "var(--b1)",
    borderRadius: 8,
    fontFamily: "var(--font)",
  },
  components: {
    Button: {
      colorPrimary: "var(--acc)",
      colorBorder: "var(--b1)",
    },
    Input: {
      colorPrimary: "var(--acc)",
      colorBorder: "var(--b1)",
    },
    Select: {
      colorPrimary: "var(--acc)",
      colorBorder: "var(--b1)",
    },
    Tabs: {
      colorPrimary: "var(--acc)",
    },
    Table: {
      headerColor: "var(--s2)",
      headerBg: "var(--b1)",
      headerSplitColor: "transparent",
      colorSplit: "var(--b1)",
      controlItemBgHover: "transparent",
      headerFilterHoverBg: "transparent",
      rowHoverBg: "var(--s2)",
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      borderRadius: 8,
    },
    Pagination: {
      itemBg: "transparent",
      itemActiveBg: "var(--b1)",
      colorText: "var(--acc)",
      colorPrimary: "var(--acc)",
      borderRadius: 4,
    },
    Checkbox: {
      colorPrimary: "var(--acc)",
      borderRadiusSM: 2,
    },
    Radio: {
      colorPrimary: "var(--acc)",
    },
    Drawer: {
      colorBgElevated: "var(--bg)",
    },
    Modal: {
      colorBgElevated: "var(--bg)",
    },
  },
});
