import { PlinthThemeProvider } from '@plinth/ui-kit';
import React from 'react';

const App: React.FC = () => {
  return (
    <PlinthThemeProvider>
      <div>
        <h1>PlinthOS Web Dashboard</h1>
      </div>
    </PlinthThemeProvider>
  );
};

export default App;
