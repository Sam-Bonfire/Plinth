import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInput } from "./SearchInput.js";

describe("SearchInput", () => {
  it("renders with default placeholder", () => {
    render(<SearchInput />);
    expect(screen.getByPlaceholderText("Search...")).toBeDefined();
  });

  it("calls onChange with typed value", () => {
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} />);
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "dosa" } });
    expect(onChange).toHaveBeenCalledWith("dosa");
  });

  it("calls onSearch on enter", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "idli" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSearch).toHaveBeenCalled();
    expect(onSearch.mock.calls[0]?.[0]).toBe("idli");
  });
});
