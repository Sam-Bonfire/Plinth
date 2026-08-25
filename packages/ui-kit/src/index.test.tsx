import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { describe, expect, it } from 'vitest';
import { PlinthThemeProvider, getThemeConfig } from './index';

describe('UI Kit Theme & Components', () => {
  it('should generate theme config correctly for light and dark modes', () => {
    const lightConfig = getThemeConfig(false);
    const darkConfig = getThemeConfig(true);

    expect(lightConfig).toBeDefined();
    expect(darkConfig).toBeDefined();
    expect(lightConfig.token?.borderRadius).toBe(8);
  });

  it('should render component wrapped in PlinthThemeProvider', () => {
    render(
      <PlinthThemeProvider>
        <Button>Plinth Button</Button>
      </PlinthThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Plinth Button' })).toBeInTheDocument();
  });
});
