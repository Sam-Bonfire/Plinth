import "./tokens.css";

export * from "./tokens.js";

export interface ThemeConfig {
  primaryColor: string;
}

export const defaultTheme: ThemeConfig = {
  primaryColor: '#1890ff',
};
