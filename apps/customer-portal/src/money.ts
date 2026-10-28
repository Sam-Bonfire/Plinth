/** Formats integer minor units as Indian rupees. */
export const inr = (minor: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
