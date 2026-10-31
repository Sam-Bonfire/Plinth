import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SiteHeader } from './SiteHeader';

const mockLinks = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
];

describe('SiteHeader', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the logo and links', () => {
    render(
      <SiteHeader
        links={mockLinks}
        ctaLabel="Get Started"
        onCtaClick={vi.fn()}
      />
    );

    expect(screen.getByText('PlinthOS')).toBeInTheDocument();

    // Antd Menu might render items multiple times depending on viewport/resize behavior,
    // so we use getAllByText
    const productLinks = screen.getAllByText('Product');
    expect(productLinks.length).toBeGreaterThan(0);
  });

  it('calls onCtaClick when the CTA button is clicked', () => {
    const onCtaClick = vi.fn();
    render(
      <SiteHeader
        links={mockLinks}
        ctaLabel="Get Started"
        onCtaClick={onCtaClick}
      />
    );

    // Desktop and mobile may each render a CTA button
    const ctaButtons = screen.getAllByRole('button', { name: /get started/i });

    // We click the desktop one (the first one usually)
    if (ctaButtons[0]) {
      fireEvent.click(ctaButtons[0]);
    }
    expect(onCtaClick).toHaveBeenCalledTimes(1);
  });

  it('opens mobile drawer when toggle button is clicked', () => {
    render(
      <SiteHeader
        links={mockLinks}
        ctaLabel="Get Started"
        onCtaClick={vi.fn()}
      />
    );

    // Testing Library might not match the aria-label correctly via role inside antd structures
    // sometimes, so we can get it via aria-label directly
    const toggleButton = screen.getByLabelText('Open mobile menu');
    fireEvent.click(toggleButton);

    // Drawer should become visible. We check for the Drawer title text or the CTA inside it.
    // Drawer title in antd is rendered in an element with class .ant-drawer-title
    expect(screen.getByText('Menu')).toBeInTheDocument();
  });
});
