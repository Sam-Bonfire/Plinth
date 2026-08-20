import type { ThemeConfig } from "antd";
import { theme } from "antd";
import "./tokens.css";

export * from "./tokens.js";

export const getThemeConfig = (isDark: boolean): ThemeConfig => ({
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: "var(--primary-color)",
    colorBorder: "var(--white-opacity-8)",
    borderRadius: 8,
    fontFamily: "var(--font)",
  },
  components: {
    Button: {
      colorPrimary: "var(--primary-color)",
      colorBorder: "var(--white-opacity-8)",
    },
    Input: {
      colorPrimary: "var(--primary-color)",
      colorBorder: "var(--white-opacity-8)",
    },
    Select: {
      colorPrimary: "var(--primary-color)",
      colorBorder: "var(--white-opacity-8)",
    },
    Tabs: {
      colorPrimary: "var(--foreground-rgb)",
    },
    Table: {
      headerColor: "var(--secondary-color)",
      headerBg: "var(--white-opacity-4)",
      headerSplitColor: "transparent",
      colorSplit: "var(--white-opacity-8)",
      controlItemBgHover: "transparent",
      headerFilterHoverBg: "transparent",
      rowHoverBg: "var(--table-hover-bg)",
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      borderRadius: 8,
    },
    Pagination: {
      itemBg: "transparent",
      itemActiveBg: "var(--white-opacity-8)",
      colorText: "var(--foreground-rgb)",
      colorPrimary: "var(--primary-color)",
      borderRadius: 4,
    },
    Checkbox: {
      colorPrimary: "var(--foreground-rgb)",
      borderRadiusSM: 2,
    },
    Radio: {
      colorPrimary: "var(--foreground-rgb)",
    },
    Drawer: {
      colorBgElevated: "var(--custom-drawer-bg)",
    },
    Modal: {
      colorBgElevated: "var(--custom-modal-bg)",
    },
  },
});
