import type { MenuItem } from '@plinth/ui-kit';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePosCartStore, selectSubtotal, selectItemCount } from './posCart';

describe('usePosCartStore', () => {
  const mockItemWithModifiers: MenuItem = {
    id: 'M-1',
    name: 'Burger',
    price: 100,
    gstRate: 5,
    isVeg: false,
    categoryId: 'C-1',
    isAvailable: true,
    modifierGroups: [
      {
        name: 'Size',
        options: [{ name: 'Small' }, { name: 'Large', price: 50 }]
      },
      {
        name: 'Addons',
        options: [{ name: 'Cheese', price: 20 }, { name: 'Bacon', price: 30 }]
      }
    ]
  };

  const mockItemNoModifiers: MenuItem = {
    id: 'M-2',
    name: 'Coke',
    price: 40,
    gstRate: 5,
    isVeg: true,
    categoryId: 'C-1',
    isAvailable: true,
    modifierGroups: []
  };

  const mockUnavailableItem: MenuItem = {
    id: 'M-3',
    name: 'Fries',
    price: 50,
    gstRate: 5,
    isVeg: true,
    categoryId: 'C-1',
    isAvailable: false,
    modifierGroups: []
  };

  beforeEach(() => {
    usePosCartStore.getState().clear();
  });

  it('valid add - adds an item with valid modifiers', () => {
    const store = usePosCartStore.getState();
    const result = store.addToCart(mockItemWithModifiers, {
      Size: 'Large',
      Addons: 'Cheese'
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toBe('M-1-Large-Cheese');
    }

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.menuItemId).toBe('M-1');
    expect(lines[0]?.modifiers).toEqual(['Large', 'Cheese']);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[0]?.unitPrice).toBe(170); // 100 + 50 + 20
  });

  it('valid add - adds an item with no modifiers', () => {
    const store = usePosCartStore.getState();
    const result = store.addToCart(mockItemNoModifiers, {});

    expect(result.ok).toBe(true);

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.menuItemId).toBe('M-2');
    expect(lines[0]?.modifiers).toEqual([]);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[0]?.unitPrice).toBe(40);
  });

  it('missing variant rejected - rejects when a required modifier is missing', () => {
    const store = usePosCartStore.getState();
    const result = store.addToCart(mockItemWithModifiers, {
      Size: 'Small'
      // Missing Addons
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Missing required modifier: Addons');
    }

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(0);
  });

  it('unavailable rejected - rejects an unavailable item', () => {
    const store = usePosCartStore.getState();
    const result = store.addToCart(mockUnavailableItem, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Item is unavailable');
    }

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(0);
  });

  it('qty merge for identical lines - merges lines with identical item and modifiers', () => {
    const store = usePosCartStore.getState();

    // Add first time
    store.addToCart(mockItemWithModifiers, {
      Size: 'Small',
      Addons: 'Bacon'
    });

    // Add second time, identical
    const result = store.addToCart(mockItemWithModifiers, {
      Size: 'Small',
      Addons: 'Bacon'
    });

    expect(result.ok).toBe(true);

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.qty).toBe(2);
    expect(lines[0]?.unitPrice).toBe(130); // 100 + 30
  });

  it('qty merge for identical lines - creates new line for different modifiers', () => {
    const store = usePosCartStore.getState();

    // Add first time
    store.addToCart(mockItemWithModifiers, {
      Size: 'Small',
      Addons: 'Bacon'
    });

    // Add second time, different modifiers
    store.addToCart(mockItemWithModifiers, {
      Size: 'Large',
      Addons: 'Cheese'
    });

    const { lines } = usePosCartStore.getState();
    expect(lines).toHaveLength(2);
    expect(lines[0]?.qty).toBe(1);
    expect(lines[1]?.qty).toBe(1);
  });

  it('totals - selectSubtotal and selectItemCount calculate correctly', () => {
    const store = usePosCartStore.getState();

    store.addToCart(mockItemWithModifiers, {
      Size: 'Small',
      Addons: 'Bacon'
    }); // 130 * 1

    store.addToCart(mockItemNoModifiers, {}); // 40 * 1

    // Update qty
    const lines = usePosCartStore.getState().lines;
    const item1Key = lines[0]?.key as string;
    usePosCartStore.getState().changeQty(item1Key, 3); // 130 * 3 = 390

    const state = usePosCartStore.getState();

    // Subtotal: 390 + 40 = 430
    expect(selectSubtotal(state)).toBe(430);

    // Item count: 3 + 1 = 4
    expect(selectItemCount(state)).toBe(4);
  });

  it('changeQty - does not update if qty is less than 1', () => {
    const store = usePosCartStore.getState();
    store.addToCart(mockItemNoModifiers, {});

    const key = usePosCartStore.getState().lines[0]?.key as string;
    usePosCartStore.getState().changeQty(key, 0);
    usePosCartStore.getState().changeQty(key, -1);

    expect(usePosCartStore.getState().lines[0]?.qty).toBe(1);
  });

  it('removeLine - removes the specified line', () => {
    const store = usePosCartStore.getState();
    store.addToCart(mockItemNoModifiers, {});

    const key = usePosCartStore.getState().lines[0]?.key as string;
    usePosCartStore.getState().removeLine(key);

    expect(usePosCartStore.getState().lines).toHaveLength(0);
  });
});
