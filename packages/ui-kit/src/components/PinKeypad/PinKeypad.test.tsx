import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PinKeypad } from "./PinKeypad";

describe("PinKeypad", () => {
  it("renders correctly", () => {
    render(
      <PinKeypad open={true} onSubmit={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText("Enter PIN")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
  });

  it("submits automatically on 4th digit", () => {
    const handleSubmit = vi.fn();
    render(
      <PinKeypad open={true} onSubmit={handleSubmit} onCancel={() => {}} />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("4"));

    expect(handleSubmit).toHaveBeenCalledWith("1234");
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("backspace removes a digit and prevents early submission", () => {
    const handleSubmit = vi.fn();
    render(
      <PinKeypad open={true} onSubmit={handleSubmit} onCancel={() => {}} />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("⌫"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByText("5"));

    expect(handleSubmit).toHaveBeenCalledWith("1245");
  });

  it("clear removes all digits", () => {
    const handleSubmit = vi.fn();
    render(
      <PinKeypad open={true} onSubmit={handleSubmit} onCancel={() => {}} />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.click(screen.getByText("6"));

    expect(handleSubmit).toHaveBeenCalledWith("3456");
  });
});
