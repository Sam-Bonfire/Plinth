import type { ThemeConfig } from "antd";
import { theme } from "antd";
import "./tokens.css";
import "./components/Badge/badge.css";

export * from "./tokens.js";

// Theme
export { PlinthThemeProvider, usePlinthTheme } from "./components/ThemeProvider/PlinthThemeProvider.js";
export type { PlinthThemeProviderProps, PlinthThemeContextType } from "./components/ThemeProvider/PlinthThemeProvider.js";

// Components
export { PlinthButton } from "./components/Button/PlinthButton.js";
export type { PlinthButtonProps, PlinthButtonVariant } from "./components/Button/PlinthButton.js";

export { OrderChannelBadge } from "./components/Badge/OrderChannelBadge.js";
export type { OrderChannelBadgeProps, OrderChannel } from "./components/Badge/OrderChannelBadge.js";

export { OrderStatusBadge } from "./components/Badge/OrderStatusBadge.js";
export type { OrderStatusBadgeProps, OrderStatus } from "./components/Badge/OrderStatusBadge.js";

export { PlinthCard } from "./components/Card/PlinthCard.js";
export type { PlinthCardProps, PlinthCardVariant } from "./components/Card/PlinthCard.js";

export { PlinthPanel } from "./components/Panel/PlinthPanel.js";
export type { PlinthPanelProps } from "./components/Panel/PlinthPanel.js";

export { ModalWrapper } from "./components/Modal/ModalWrapper.js";
export type { ModalWrapperProps } from "./components/Modal/ModalWrapper.js";

export { PinKeypad } from "./components/PinKeypad/PinKeypad.js";
export type { PinKeypadProps } from "./components/PinKeypad/PinKeypad.js";

export { FormSection } from "./components/Form/FormSection.js";
export type { FormSectionProps } from "./components/Form/FormSection.js";

export { FormRow } from "./components/Form/FormRow.js";
export type { FormRowProps } from "./components/Form/FormRow.js";

export { AlertBanner } from "./components/AlertBanner/AlertBanner.js";
export type { AlertBannerProps } from "./components/AlertBanner/AlertBanner.js";

export { KDSTicketCard } from "./components/KDSTicketCard/KDSTicketCard.js";
export type { KDSTicketCardProps, KDSTicketItem } from "./components/KDSTicketCard/KDSTicketCard.js";

export const getThemeConfig = (isDark: boolean): ThemeConfig => ({
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: "var(--acc)",
    colorBorder: "var(--b1)",
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: "var(--font)",
    fontFamilyCode: "var(--mono)",
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
