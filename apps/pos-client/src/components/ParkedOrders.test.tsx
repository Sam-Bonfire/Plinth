import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePosCartStore } from '../stores/posCart.js';
import { ParkedOrders } from './ParkedOrders.js';

describe('ParkedOrders', () => {
  beforeEach(() => {
    usePosCartStore.getState().clear();
    usePosCartStore.setState({ parkedOrders: [] });
  });

  it('renders empty state when no parked orders', () => {
    render(<ParkedOrders />);
    expect(screen.getByText('No parked orders')).toBeInTheDocument();
  });

  it('renders parked orders and formats currency correctly', () => {
    // Populate store
    usePosCartStore.setState({
      parkedOrders: [
        {
          id: 'p-1',
          customerLabel: 'John Doe',
          timestamp: new Date('2023-01-01T12:00:00Z').toISOString(),
          lines: [
            {
              key: 'L-1',
              menuItemId: 'M-1',
              name: 'Burger',
              modifiers: [],
              qty: 2,
              unitPrice: 1500, // $15.00
            }
          ]
        }
      ]
    });

    render(<ParkedOrders />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('Total: $30.00')).toBeInTheDocument();
  });

  it('calls resumeOrder when Resume button is clicked', () => {
    const resumeSpy = vi.spyOn(usePosCartStore.getState(), 'resumeOrder');

    usePosCartStore.setState({
      parkedOrders: [
        {
          id: 'p-1',
          customerLabel: 'Jane Doe',
          timestamp: new Date().toISOString(),
          lines: []
        }
      ]
    });

    render(<ParkedOrders />);

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));

    expect(resumeSpy).toHaveBeenCalledWith('p-1');
  });

  it('calls voidOrder when Void button is clicked', () => {
    const voidSpy = vi.spyOn(usePosCartStore.getState(), 'voidOrder');

    usePosCartStore.setState({
      parkedOrders: [
        {
          id: 'p-2',
          customerLabel: 'Test Void',
          timestamp: new Date().toISOString(),
          lines: []
        }
      ]
    });

    render(<ParkedOrders />);

    fireEvent.click(screen.getByRole('button', { name: /void/i }));

    expect(voidSpy).toHaveBeenCalledWith('p-2');
  });
});
