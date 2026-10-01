import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Marketing Site App', () => {
  it('assembles header, sections, and footer', async () => {
    render(<App />);
    expect(await screen.findByRole('banner')).toBeDefined();
    expect(await screen.findByText('Power Your Restaurant')).toBeDefined();
    expect(await screen.findByRole('contentinfo')).toBeDefined();
  });

  it('exposes anchor targets for header links and CTA', async () => {
    render(<App />);
    for (const id of ['product', 'pricing', 'docs', 'contact']) {
      expect(await screen.findByRole('region', { name: new RegExp(id, 'i') })).toBeDefined();
    }
    expect(await screen.findByRole('link', { name: 'PlinthOS home' })).toBeDefined();
  });
});
