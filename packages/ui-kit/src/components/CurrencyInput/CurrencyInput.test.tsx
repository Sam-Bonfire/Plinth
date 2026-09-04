import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CurrencyInput } from "./CurrencyInput";

describe("CurrencyInput", () => {
  it("renders correctly with default currency", () => {
    render(<CurrencyInput />);
    expect(screen.getByLabelText("Currency Input")).toBeDefined();
    expect(screen.getByText("INR")).toBeDefined();
  });

  it("handles numeric input properly", () => {
    const handleChange = vi.fn();
    render(<CurrencyInput onChange={handleChange} />);

    const input = screen.getByLabelText("Currency Input");
    fireEvent.change(input, { target: { value: "100" } });

    // antd InputNumber calls onChange
    expect(handleChange).toHaveBeenCalledWith(100);
  });

  it("adds quick increments correctly", () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <CurrencyInput value={100} onChange={handleChange} quickIncrements={[50, 100]} />
    );

    const btn50 = screen.getByText("+50");
    const btn100 = screen.getByText("+100");

    fireEvent.click(btn50);
    expect(handleChange).toHaveBeenCalledWith(150);

    // Let's simulate a value change and then click another increment
    rerender(
      <CurrencyInput value={150} onChange={handleChange} quickIncrements={[50, 100]} />
    );

    fireEvent.click(btn100);
    expect(handleChange).toHaveBeenCalledWith(250);
  });

  it("respects allowNegative constraint", () => {
    // If allowNegative is false, Ant Design sets min={0}, making it impossible to input negative values
    // Testing the dom attribute `min`
    render(<CurrencyInput allowNegative={false} />);
    const input = screen.getByLabelText("Currency Input") as HTMLInputElement;
    expect(input.getAttribute("aria-valuemin")).toBe("0");
  });

  it("allows negative when allowNegative is true", () => {
    render(<CurrencyInput allowNegative={true} />);
    const input = screen.getByLabelText("Currency Input") as HTMLInputElement;
    expect(input.getAttribute("aria-valuemin")).toBeNull();
  });

  it("formats decimal precision correctly on increment", () => {
    const handleChange = vi.fn();
    render(
      <CurrencyInput value={100.1} decimals={2} onChange={handleChange} quickIncrements={[10]} />
    );

    const btn10 = screen.getByText("+10");
    fireEvent.click(btn10);
    expect(handleChange).toHaveBeenCalledWith(110.1);
  });
});
