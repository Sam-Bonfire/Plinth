import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PricingCards } from './PricingCards';

describe('PricingCards Component', () => {
  it('renders default pricing tiers correctly', () => {
    render(<PricingCards />);

    // Check for tier names
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();

    // Check for prices (in INR)
    expect(screen.getByText('₹999/mo')).toBeInTheDocument();
    expect(screen.getByText('₹2,999/mo')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();

    // Check for a specific feature from each to ensure feature lists render
    expect(screen.getByText('Up to 1,000 customers')).toBeInTheDocument();
    expect(screen.getByText('Priority email & chat support')).toBeInTheDocument();
    expect(screen.getByText('SLA guarantee')).toBeInTheDocument();
  });

  it('highlights the recommended tier', () => {
    render(<PricingCards />);

    // Growth is recommended by default
    const recommendedBadge = screen.getByText('RECOMMENDED');
    expect(recommendedBadge).toBeInTheDocument();
  });

  it('renders custom tiers when provided', () => {
    const customTiers = [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: '$10/mo',
        features: ['Feature 1', 'Feature 2'],
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        price: '$20/mo',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
        recommended: true,
      },
    ];

    render(<PricingCards tiers={customTiers} />);

    expect(screen.getByText('Basic Plan')).toBeInTheDocument();
    expect(screen.getByText('$10/mo')).toBeInTheDocument();
    expect(screen.getAllByText('Feature 1')[0]).toBeInTheDocument();

    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.getByText('$20/mo')).toBeInTheDocument();
    expect(screen.getByText('Feature 3')).toBeInTheDocument();
    expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();

    // Ensure default tiers are not rendered
    expect(screen.queryByText('Starter')).not.toBeInTheDocument();
  });
});
