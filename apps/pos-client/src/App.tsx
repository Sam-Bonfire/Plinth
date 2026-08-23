import { getThemeConfig } from '@plinth/ui-kit';
import { ConfigProvider } from 'antd';
import React, { useMemo } from 'react';
import { ShowcaseView } from './showcase/ShowcaseView';

export const PlinthThemeProvider: React.FC<{ children: React.ReactNode; isDark?: boolean }> = ({ children, isDark = false }) => {
  return (
    <ConfigProvider theme={getThemeConfig(isDark)}>
      {children}
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const scene = params.get('scene');
  const isDark = params.get('theme') === 'dark';

  if (scene) {
    return (
      <PlinthThemeProvider isDark={isDark}>
        <ShowcaseView scene={scene} />
      </PlinthThemeProvider>
    );
  }

  return (
    <PlinthThemeProvider isDark={isDark}>
      <ShowcaseView scene="active-order" />
    </PlinthThemeProvider>
  );
};

export default App;
