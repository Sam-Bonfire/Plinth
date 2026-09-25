import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Orders } from './Orders';
import { saveOrder } from './session';

describe('Orders page', () => {
  it('shows empty state with a menu link', () => {
    localStorage.clear();
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(screen.getByText('No orders yet.')).toBeDefined();
  });

  it('lists placed session orders', () => {
    localStorage.clear();
    saveOrder({ order_id: 'ORD-1', ticket_id: 'T-1', total_minor: 2000, itemCount: 2, placedAt: new Date().toISOString() });
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(screen.getByText('ORD-1')).toBeDefined();
    localStorage.clear();
  });

  it('shows live status when the endpoint resolves', async () => {
    localStorage.clear();
    saveOrder({ order_id: 'ORD-9', ticket_id: 'T-9', total_minor: 2000, itemCount: 2, placedAt: new Date().toISOString() });
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ order_id: 'ORD-9', status: 'Preparing' }) })
    ) as unknown as typeof fetch;
    render(
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    );
    expect(await screen.findByText('Preparing')).toBeDefined();
    localStorage.clear();
  });
});
