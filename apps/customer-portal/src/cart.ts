export interface CartLine {
  id: string;
  name: string;
  price_minor: number;
  qty: number;
}

export type Cart = CartLine[];

/** Adds one unit of an item (or bumps qty when already present). */
export const addToCart = (cart: Cart, item: { id: string; name: string; price_minor: number }): Cart => {
  const existing = cart.find((l: CartLine): boolean => l.id === item.id);
  if (existing) {
    return cart.map((l: CartLine): CartLine => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
  }
  return [...cart, { ...item, qty: 1 }];
};

export const setLineQty = (cart: Cart, id: string, qty: number): Cart =>
  qty <= 0 ? cart.filter((l: CartLine): boolean => l.id !== id) : cart.map((l: CartLine): CartLine => (l.id === id ? { ...l, qty } : l));

export const cartCount = (cart: Cart): number => cart.reduce((n: number, l: CartLine): number => n + l.qty, 0);

export const cartTotal = (cart: Cart): number => cart.reduce((n: number, l: CartLine): number => n + l.qty * l.price_minor, 0);

export const inr = (minor: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
