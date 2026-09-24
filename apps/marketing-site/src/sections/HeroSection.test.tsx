import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { HeroSection, calculateTotal, BillItem } from './HeroSection';

describe('calculateTotal helper', () => {
  it('returns 0 for an empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('calculates the correct total for multiple items', () => {
    const items: BillItem[] = [
      { id: '1', name: 'Item 1', priceCents: 100, quantity: 2 },
      { id: '2', name: 'Item 2', priceCents: 50, quantity: 1 },
    ];
    expect(calculateTotal(items)).toBe(250);
  });
});

describe('HeroSection', () => {
  it('renders correctly with default props', () => {
    render(<HeroSection />);
    expect(screen.getByText('Power Your Restaurant')).toBeInTheDocument();
    expect(screen.getByText('The all-in-one POS and management system built for modern hospitality.')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Book a Demo')).toBeInTheDocument();
  });

  it('renders correctly with custom props', () => {
    render(
      <HeroSection
        headline="Custom Headline"
        subcopy="Custom Subcopy"
        primaryCtaText="Custom Primary"
        secondaryCtaText="Custom Secondary"
      />
    );
    expect(screen.getByText('Custom Headline')).toBeInTheDocument();
    expect(screen.getByText('Custom Subcopy')).toBeInTheDocument();
    expect(screen.getByText('Custom Primary')).toBeInTheDocument();
    expect(screen.getByText('Custom Secondary')).toBeInTheDocument();
  });

  it('triggers CTA callbacks on click', () => {
    const primarySpy = vi.fn();
    const secondarySpy = vi.fn();

    render(
      <HeroSection
        onPrimaryCtaClick={primarySpy}
        onSecondaryCtaClick={secondarySpy}
      />
    );

    fireEvent.click(screen.getByText('Get Started'));
    expect(primarySpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Book a Demo'));
    expect(secondarySpy).toHaveBeenCalledTimes(1);
  });

  it('adds items to the bill and updates the total when a menu item is clicked', () => {
    render(<HeroSection />);

    // Initially, total should be $0.00 and list empty
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('No items yet')).toBeInTheDocument();

    // Click 'Espresso' ($3.50)
    const espressoButton = screen.getByRole('button', { name: /espresso/i });
    fireEvent.click(espressoButton);

    // Bill should show 1x Espresso and new total
    expect(screen.getByText('1x Espresso')).toBeInTheDocument();
    expect(screen.getAllByText('$3.50')[1]).toBeInTheDocument(); // Select the one in the bill, not the button

    // Click 'Espresso' again to increase quantity
    fireEvent.click(espressoButton);
    expect(screen.getByText('2x Espresso')).toBeInTheDocument();
    expect(screen.getAllByText('$7.00')[1]).toBeInTheDocument();

    // Click 'Latte' ($4.50)
    const latteButton = screen.getByRole('button', { name: /latte/i });
    fireEvent.click(latteButton);

    // Total should be $7.00 + $4.50 = $11.50
    expect(screen.getByText('1x Latte')).toBeInTheDocument();
    expect(screen.getByText('$11.50')).toBeInTheDocument();
  });
});
