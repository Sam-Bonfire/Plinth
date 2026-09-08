import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToggleSwitch } from "./ToggleSwitch.js";

describe("ToggleSwitch", () => {
  it("renders unchecked by default", () => {
    render(<ToggleSwitch />);
    expect(screen.getByTestId("toggle-switch")).toBeDefined();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange with toggled value", () => {
    const onChange = vi.fn();
    render(<ToggleSwitch onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]?.[0]).toBe(true);
  });

  it("renders checked and disabled states", () => {
    render(<ToggleSwitch checked disabled checkedChildren="Live" unCheckedChildren="86'd" />);
    const el = screen.getByRole("switch");
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(el.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByText("Live")).toBeDefined();
  });
});
