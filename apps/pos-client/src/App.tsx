import { PlinthThemeProvider } from '@plinth/ui-kit';
import React, { useMemo } from 'react';
import { PosApp } from './router.js';
import { ShowcaseView } from './showcase/ShowcaseView.js';

const App: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const scene = params.get('scene');
  const isDark = params.get('theme') === 'dark';

  if (scene) {
    return (
      <PlinthThemeProvider overrideIsDark={isDark}>
        <ShowcaseView scene={scene} />
      </PlinthThemeProvider>
    );
  }

  return <PosApp isDark={isDark} />;
};

export default App;
