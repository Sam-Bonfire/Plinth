import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import { describe, expect, it } from 'vitest';
import * as PublicSurface from './index';

const { PlinthThemeProvider } = PublicSurface;

describe('UI Kit Theme & Components', () => {
  it('should render component wrapped in PlinthThemeProvider', () => {
    render(
      <PlinthThemeProvider>
        <Button>Plinth Button</Button>
      </PlinthThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Plinth Button' })).toBeDefined();
  });

  it('should expose the critical public surface (P-675)', () => {
    const surface = PublicSurface as Record<string, unknown>;
    for (const name of [
      'TOKENS',
      'TOKENS_BY_MODE',
      'PlinthThemeProvider',
      'PlinthButton',
      'PlinthCard',
      'PlinthPanel',
      'AlertBanner',
      'CurrencyInput',
      'PlinthAvatar',
      'PlinthTitle',
      'PlinthText',
      'MonoText',
      'CurrencyText',
      'formatCurrency',
      'ToastManager',
      'useUiStore',
    ]) {
      expect(surface[name], `missing export: ${name}`).toBeDefined();
    }
  });
});
