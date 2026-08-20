import React from 'react';
import { ConfigProvider, ThemeConfig } from 'antd';

export const plinthTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0d110e',
    colorBgLayout: '#f4f5f4',
    colorBgContainer: '#ffffff',
    colorBorder: 'rgba(0, 0, 0, 0.08)',
    fontFamily: 'Instrument Sans, sans-serif',
    fontFamilyCode: 'IBM Plex Mono, monospace',
    borderRadius: 10,
  },
};

export interface PlinthThemeProviderProps {
  children: React.ReactNode;
}

export const PlinthThemeProvider: React.FC<PlinthThemeProviderProps> = ({ children }) => {
  return React.createElement(ConfigProvider, { theme: plinthTheme }, children);
};
