import { describe, expect, it } from 'vitest';
import { addToCart, cartCount, cartTotal, inr, setLineQty } from './cart.js';

describe('cart helpers', () => {
  it('adds new lines and bumps existing qty', () => {
    let cart = addToCart([], { id: 'm1', name: 'Burger', price_minor: 1000 });
    cart = addToCart(cart, { id: 'm1', name: 'Burger', price_minor: 1000 });
    cart = addToCart(cart, { id: 'm2', name: 'Fries', price_minor: 500 });
    expect(cartCount(cart)).toBe(3);
    expect(cartTotal(cart)).toBe(2500);
  });

  it('removes lines at zero qty', () => {
    const cart = setLineQty([{ id: 'm1', name: 'Burger', price_minor: 1000, qty: 2 }], 'm1', 0);
    expect(cart).toEqual([]);
  });

  it('formats minor units', () => {
    expect(inr(1000)).toContain('10');
  });
});
