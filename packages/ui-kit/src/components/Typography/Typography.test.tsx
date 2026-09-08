import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyText, MonoText, PlinthText, PlinthTitle, formatINR } from "./Typography.js";

describe("Typography primitives", () => {
  it("renders PlinthTitle with heading role", () => {
    render(<PlinthTitle level={4}>Dashboard</PlinthTitle>);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeDefined();
  });

  it("renders PlinthText children", () => {
    render(<PlinthText>hello</PlinthText>);
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("renders MonoText with mono font", () => {
    render(<MonoText>ORD-001</MonoText>);
    const el = screen.getByText("ORD-001");
    expect(el.getAttribute("style") ?? "").toContain("var(--mono)");
  });

  it("formats CurrencyText as en-IN INR", () => {
    expect(formatINR(1234.5)).toBe("₹1,234.50");
    expect(formatINR(NaN)).toBe("—");
    render(<CurrencyText value={1234.5} />);
    expect(screen.getByText("₹1,234.50")).toBeDefined();
  });
});
