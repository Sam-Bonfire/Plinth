import React from 'react';
import { ConfigProvider } from 'antd';
import { getThemeConfig } from '@plinth/ui-kit';
import { useFontsLoaded } from '@plinth/ui-kit/fonts/loader.js';

const PlinthThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeConfig = getThemeConfig(false);
  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  const fontsLoaded = useFontsLoaded();

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <PlinthThemeProvider>
      <div>
        <h1>PlinthOS Marketing Site</h1>
      </div>
    </PlinthThemeProvider>
  );
};

export default App;
