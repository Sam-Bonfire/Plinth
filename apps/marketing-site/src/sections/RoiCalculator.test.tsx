import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RoiCalculator, roiEstimate } from './RoiCalculator.js';

describe('roiEstimate helper function', () => {
  it('calculates monthly savings and payback months correctly with positive values', () => {
    // 100 orders/day * $15.00 avg bill * 30 days * 1 outlet = $45,000 revenue
    // 2% savings = $900 (90000 cents)
    // Payback = $500 / $900 = 0.555... months
    const result = roiEstimate({
      ordersPerDay: 100,
      avgBill: 1500, // cents
      outlets: 1,
    });

    expect(result.monthlySavings).toBe(90000);
    expect(result.paybackMonths).toBeCloseTo(0.556, 3);
  });

  it('calculates multiple outlets correctly', () => {
    // 100 orders/day * $15.00 avg bill * 30 days * 2 outlets = $90,000 revenue
    // 2% savings = $1800 (180000 cents)
    // Payback = $1000 / $1800 = 0.555... months
    const result = roiEstimate({
      ordersPerDay: 100,
      avgBill: 1500, // cents
      outlets: 2,
    });

    expect(result.monthlySavings).toBe(180000);
    expect(result.paybackMonths).toBeCloseTo(0.556, 3);
  });

  it('returns 0 for zero inputs', () => {
    const result = roiEstimate({ ordersPerDay: 0, avgBill: 0, outlets: 0 });
    expect(result.monthlySavings).toBe(0);
    expect(result.paybackMonths).toBe(0);
  });

  it('returns 0 for negative inputs', () => {
    const result = roiEstimate({ ordersPerDay: -10, avgBill: 1500, outlets: 1 });
    expect(result.monthlySavings).toBe(0);
    expect(result.paybackMonths).toBe(0);
  });
});

describe('RoiCalculator component', () => {
  it('renders default values correctly', () => {
    render(<RoiCalculator />);

    const ordersInput = screen.getByRole('spinbutton', { name: /orders per day/i });
    expect(ordersInput).toHaveValue('100');

    const avgBillInput = screen.getByRole('spinbutton', { name: /average bill/i });
    expect(avgBillInput).toHaveValue('15.00');

    const outletsInput = screen.getByRole('spinbutton', { name: /number of outlets/i });
    expect(outletsInput).toHaveValue('1');

    // 100 * 15 * 30 * 1 = 45000 * 0.02 = 900
    const savingsEl = screen.getByTestId('monthly-savings');
    expect(savingsEl.textContent).toContain('900.00');
  });

  it('updates calculations when inputs change', async () => {
    const user = userEvent.setup();
    render(<RoiCalculator defaultOrdersPerDay={100} defaultAvgBill={1500} defaultOutlets={1} />);

    // Initial verification
    let savingsEl = screen.getByTestId('monthly-savings');
    expect(savingsEl.textContent).toContain('900.00');

    // Change Orders per Day to 200
    const ordersInput = screen.getByRole('spinbutton', { name: /orders per day/i });
    await user.clear(ordersInput);
    await user.type(ordersInput, '200');

    // Expected: 200 * 15 * 30 * 1 = 90000 * 0.02 = 1800
    savingsEl = screen.getByTestId('monthly-savings');
    expect(savingsEl.textContent).toContain('1,800.00'); // Antd formats with commas

    // Change Outlets to 2
    const outletsInput = screen.getByRole('spinbutton', { name: /number of outlets/i });
    await user.clear(outletsInput);
    await user.type(outletsInput, '2');

    // Expected: 200 * 15 * 30 * 2 = 180000 * 0.02 = 3600
    savingsEl = screen.getByTestId('monthly-savings');
    expect(savingsEl.textContent).toContain('3,600.00');
  });
});
