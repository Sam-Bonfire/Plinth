import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { PillarsGrid } from './PillarsGrid.js';

describe('PillarsGrid', () => {
  it('renders default pillars correctly', () => {
    render(<PillarsGrid />);

    // Check for the titles of the 4 default pillars
    expect(screen.getByText('Offline-First')).toBeInTheDocument();
    expect(screen.getByText('Double-Entry Ledger')).toBeInTheDocument();
    expect(screen.getByText('LAN KDS')).toBeInTheDocument();
    expect(screen.getByText('Edge Sync')).toBeInTheDocument();

    // Check for some of the descriptions
    expect(
      screen.getByText('Keep your restaurant running smoothly even when the internet goes down.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Seamlessly sync data across your devices and the cloud at the edge.')
    ).toBeInTheDocument();
  });

  it('renders custom pillars when passed via props', () => {
    const customPillars = [
      {
        key: 'custom-1',
        icon: <span data-testid="custom-icon">🔥</span>,
        title: 'Custom Pillar',
        description: 'This is a custom pillar description.',
      },
    ];

    render(<PillarsGrid pillars={customPillars} />);

    // Custom pillars should be rendered
    expect(screen.getByText('Custom Pillar')).toBeInTheDocument();
    expect(screen.getByText('This is a custom pillar description.')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();

    // Default pillars should not be rendered
    expect(screen.queryByText('Offline-First')).not.toBeInTheDocument();
  });
});
