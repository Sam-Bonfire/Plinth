import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { PlinthButton } from "./PlinthButton.js";

describe("PlinthButton", () => {
  it("renders children correctly", () => {
    render(<PlinthButton>Click me</PlinthButton>);
    expect(screen.getByText("Click me")).toBeTruthy();
  });

  it("handles clicks", () => {
    const handleClick = vi.fn();
    render(<PlinthButton onClick={handleClick}>Click</PlinthButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows shortcut key", () => {
    render(<PlinthButton shortcutKey="Ctrl+S">Save</PlinthButton>);
    expect(screen.getByTestId("shortcut-key").textContent).toBe("Ctrl+S");
  });

  it("applies pos-action specific styles and classes", () => {
    render(<PlinthButton variant="pos-action">Charge</PlinthButton>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("plinth-btn-pos-action");
    expect(button.style.minHeight).toBe("48px");
    expect(button.style.fontWeight).toBe("bold");
  });

  it("disables button correctly", () => {
    render(<PlinthButton disabled>Disabled</PlinthButton>);
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
  });

  it("shows loading state", () => {
    render(<PlinthButton loading>Loading</PlinthButton>);
    expect(screen.getByRole("button").className).toContain("ant-btn-loading");
  });
});
