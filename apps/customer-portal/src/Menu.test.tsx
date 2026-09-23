import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu } from './Menu';

const mockCatalog = {
  categories: [
    {
      id: 'cat-1',
      name: 'Burgers',
      items: [
        {
          id: 'item-1',
          name: 'Classic Burger',
          description: 'Beef patty with cheese',
          price_minor: 1000,
          is_veg: false,
        },
        {
          id: 'item-2',
          name: 'Veggie Burger',
          description: 'Plant-based patty',
          price_minor: 1200,
          is_veg: true,
        },
      ],
    },
  ],
};

describe('Menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    render(
      <MemoryRouter initialEntries={['/?tenant_id=test-tenant']}>
        <Menu />
      </MemoryRouter>
    );
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull();
    // Spin renders with a specific class or we can just rely on not finding other text
    expect(screen.queryByText('Digital Menu')).toBeNull();
  });

  it('renders error if missing tenant_id', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Menu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Missing tenant_id in URL')).toBeDefined();
    });
  });

  it('renders error on fetch failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;
    render(
      <MemoryRouter initialEntries={['/?tenant_id=test-tenant']}>
        <Menu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('renders items from mocked fetch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCatalog),
      })
    ) as any;

    render(
      <MemoryRouter initialEntries={['/?tenant_id=test-tenant']}>
        <Menu />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Digital Menu')).toBeDefined();
    });

    // Check if category is rendered
    expect(screen.getByText('Burgers')).toBeDefined();

    // Check if items are rendered
    expect(screen.getByText('Classic Burger')).toBeDefined();
    expect(screen.getByText('Beef patty with cheese')).toBeDefined();
    expect(screen.getByText('$10.00')).toBeDefined();

    expect(screen.getByText('Veggie Burger')).toBeDefined();
    expect(screen.getByText('Plant-based patty')).toBeDefined();
    expect(screen.getByText('$12.00')).toBeDefined();

    // Check for Veg badge
    expect(screen.getByText('Veg')).toBeDefined();
  });
});
