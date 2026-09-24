import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceTicket, KdsDemo, KdsTicket } from './KdsDemo.js';

describe('KdsDemo', () => {
  describe('advanceTicket helper', () => {
    it('should mark the specified ticket as done and leave others unchanged', () => {
      const tickets: KdsTicket[] = [
        { id: 't1', orderNumber: '1', createdAtMs: 1000, items: [], status: 'active' },
        { id: 't2', orderNumber: '2', createdAtMs: 1000, items: [], status: 'active' },
      ];

      const nextTickets = advanceTicket(tickets, 't1');
      expect(nextTickets.find((t) => t.id === 't1')?.status).toBe('done');
      expect(nextTickets.find((t) => t.id === 't2')?.status).toBe('active');
    });
  });

  describe('KdsDemo Component', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders initial tickets and advances time correctly', () => {
      const now = Date.now();
      const mockTickets: KdsTicket[] = [
        {
          id: 'test-1',
          orderNumber: 'TEST-99',
          createdAtMs: now - 60000, // 1 minute ago
          status: 'active',
          items: [{ id: 'i1', name: 'Test Burger', quantity: 1 }],
        },
      ];

      render(<KdsDemo initialTickets={mockTickets} />);

      expect(screen.getByText('Order TEST-99')).toBeTruthy();
      expect(screen.getByText('1x')).toBeTruthy();
      expect(screen.getByText('Test Burger')).toBeTruthy();

      // Should show 1:00 initially
      expect(screen.getByText('1:00')).toBeTruthy();

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Elapsed should update to 1:05
      expect(screen.getByText('1:05')).toBeTruthy();
    });

    it('removes a ticket from active view when Bump is clicked', () => {
      const mockTickets: KdsTicket[] = [
        {
          id: 'test-bump',
          orderNumber: 'TEST-BUMP',
          createdAtMs: Date.now(),
          status: 'active',
          items: [],
        },
      ];

      render(<KdsDemo initialTickets={mockTickets} />);

      expect(screen.getByText('Order TEST-BUMP')).toBeTruthy();

      const bumpButton = screen.getByText('Bump');
      fireEvent.click(bumpButton);

      expect(screen.queryByText('Order TEST-BUMP')).toBeNull();
      expect(screen.getByText('No active tickets!')).toBeTruthy();
    });
  });
});
