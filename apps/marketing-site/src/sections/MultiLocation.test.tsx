import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MultiLocation } from './MultiLocation.js';

describe('MultiLocation', () => {
  it('renders default text, stats, and features correctly', () => {
    render(<MultiLocation />);

    // Default headers
    expect(screen.getByText('Enterprise Management at Scale')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Empower your multi-location restaurant brand with robust tools designed for complex operations.'
      )
    ).toBeInTheDocument();

    // Default Stats
    expect(screen.getByText('Locations Managed')).toBeInTheDocument();
    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Uptime')).toBeInTheDocument();
    expect(screen.getByText('Global Regions')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // Default Features
    expect(screen.getByText('Central Menu Control')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manage menus, pricing, and promotions across all your locations from a single dashboard.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Consolidated Reports')).toBeInTheDocument();
    expect(screen.getByText('Inter-Store Transfers')).toBeInTheDocument();
    expect(screen.getByText('Role Hierarchies')).toBeInTheDocument();
  });

  it('renders custom props when provided', () => {
    const customStats = [
      {
        key: 'custom-stat-1',
        title: 'Custom Stat Title',
        value: '999',
      },
    ];

    const customFeatures = [
      {
        key: 'custom-feature-1',
        icon: <span data-testid="custom-icon">✨</span>,
        title: 'Custom Feature Title',
        description: 'This is a custom feature description.',
      },
    ];

    render(
      <MultiLocation
        title="Custom Title"
        description="Custom Description"
        stats={customStats}
        features={customFeatures}
      />
    );

    // Custom text
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();

    // Custom stat
    expect(screen.getByText('Custom Stat Title')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();

    // Custom feature
    expect(screen.getByText('Custom Feature Title')).toBeInTheDocument();
    expect(screen.getByText('This is a custom feature description.')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();

    // Defaults should not be rendered
    expect(screen.queryByText('Enterprise Management at Scale')).not.toBeInTheDocument();
    expect(screen.queryByText('Locations Managed')).not.toBeInTheDocument();
    expect(screen.queryByText('Central Menu Control')).not.toBeInTheDocument();
  });
});
