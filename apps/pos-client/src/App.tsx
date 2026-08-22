import { getThemeConfig } from '@plinth/ui-kit';
import { ConfigProvider } from 'antd';
import React from 'react';

export const PlinthThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ConfigProvider theme={getThemeConfig(false)}>
      {children}
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <PlinthThemeProvider>
      <div>
        <h1>PlinthOS POS Terminal</h1>
      </div>
    </PlinthThemeProvider>
  );
};

export default App;
