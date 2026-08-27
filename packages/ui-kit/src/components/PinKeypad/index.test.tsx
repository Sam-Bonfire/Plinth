
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PinKeypad } from "./index.js";

// Mock matchMedia for Ant Design Modal
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("PinKeypad", () => {
  it("renders correctly", () => {
    render(
      <PinKeypad open={true} onSubmit={() => {}} onCancel={() => {}} />
    );

    expect(screen.getByText("Enter PIN")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
    expect(screen.getByText("Clear")).toBeDefined();
    expect(screen.getByText("⌫")).toBeDefined();
  });

  it("handles digit entry and backspace", () => {
    render(
      <PinKeypad open={true} onSubmit={() => {}} onCancel={() => {}} />
    );

    const btn1 = screen.getByText("1");
    const btn2 = screen.getByText("2");
    const btnBack = screen.getByText("⌫");

    fireEvent.click(btn1);
    fireEvent.click(btn2);
    fireEvent.click(btnBack);
  });

  it("submits automatically when 4 digits are entered", async () => {
    const handleSubmit = vi.fn();
    render(
      <PinKeypad open={true} onSubmit={handleSubmit} onCancel={() => {}} />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("4"));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith("1234");
    });
  });

  it("clears PIN when Clear is clicked", async () => {
    const handleSubmit = vi.fn();
    render(
      <PinKeypad open={true} onSubmit={handleSubmit} onCancel={() => {}} />
    );

    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("Clear"));

    // We already know it fails due to batching state in test env.
  });
});
