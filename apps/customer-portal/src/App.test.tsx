import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./Menu', () => ({
  Menu: (): React.JSX.Element => <div>menu-page</div>,
}));

vi.mock('./Orders', () => ({
  Orders: (): React.JSX.Element => <div>orders-page</div>,
}));

describe('App shell', () => {
  it('renders brand home, portal nav and skip link', async () => {
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toBeDefined();
    expect(await screen.findByRole('link', { name: 'Portal home' })).toBeDefined();
    expect(await screen.findByRole('navigation', { name: 'Portal' })).toBeDefined();
    expect(await screen.findByText('menu-page')).toBeDefined();
  });
});
