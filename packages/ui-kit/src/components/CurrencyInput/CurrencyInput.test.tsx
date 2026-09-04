import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CurrencyInput } from './CurrencyInput.js';

describe('CurrencyInput', () => {
  it('renders with default props', () => {
    render(<CurrencyInput />);
    expect(screen.getByRole('spinbutton')).toBeDefined();
    expect(screen.getByText('₹')).toBeDefined();
  });

  it('renders with custom currency symbol', () => {
    render(<CurrencyInput currency="$" />);
    expect(screen.getByText('$')).toBeDefined();
  });

  it('calls onChange with correct values', () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '100' } });
    expect(handleChange).toHaveBeenCalledWith(100);
  });

  it('formats decimals correctly (2 decimals by default)', () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '10.55' } });
    expect(handleChange).toHaveBeenCalledWith(10.55);
  });

  it('restricts negative values when allowNegative is false', () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} allowNegative={false} />);
    const input = screen.getByRole('spinbutton');

    // In Vitest with antd InputNumber, `aria-valuemin` is set to '0' rather than `min="0"` directly on the input element by default,
    // let's check `aria-valuemin`
    expect(input.getAttribute('aria-valuemin')).toBe('0');
  });

  it('allows negative values when allowNegative is true', () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} allowNegative={true} />);
    const input = screen.getByRole('spinbutton');
    expect(input.getAttribute('aria-valuemin')).toBeNull();
  });

  it('renders quick increment chips and handles clicks', () => {
    const handleChange = vi.fn();
    render(
      <CurrencyInput
        value={10}
        onChange={handleChange}
        quickIncrements={[10, 50, 100]}
        currency="₹"
      />
    );

    const chip10 = screen.getByText('+₹10');
    const chip50 = screen.getByText('+₹50');
    const chip100 = screen.getByText('+₹100');

    expect(chip10).toBeDefined();
    expect(chip50).toBeDefined();
    expect(chip100).toBeDefined();

    fireEvent.click(chip50);

    expect(handleChange).toHaveBeenCalledWith(60);
  });

  it('does not trigger quick increments if disabled', () => {
    const handleChange = vi.fn();
    render(
      <CurrencyInput
        value={10}
        onChange={handleChange}
        quickIncrements={[10, 50, 100]}
        disabled={true}
      />
    );

    const chip50 = screen.getByRole('button', { name: /\+₹50/ });
    expect((chip50 as HTMLButtonElement).disabled).toBe(true);
  });
});

  it('allows typing negative sign alone initially', () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} allowNegative={true} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-' } });
    // It shouldn't crash, and should probably just wait until a number is typed
    expect(input.getAttribute('aria-valuemin')).toBeNull();
  });
