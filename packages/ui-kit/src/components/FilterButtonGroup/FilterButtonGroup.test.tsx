import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FilterButtonGroup } from "./FilterButtonGroup.js";

describe("FilterButtonGroup", () => {
  const options = [
    { value: "all", label: "All" },
    { value: "active", label: "Active", count: 5 },
    { value: "completed", label: "Completed" },
  ];

  it("renders correctly in single-select mode", () => {
    const onChange = vi.fn();
    render(<FilterButtonGroup options={options} value="all" onChange={onChange} />);

    const buttons = screen.getAllByRole("radio");
    expect(buttons).toHaveLength(3);

    // Check initial selection
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
    expect(buttons[1].getAttribute("aria-checked")).toBe("false");

    // Check labels and counts
    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
  });

  it("handles single selection toggle", () => {
    const onChange = vi.fn();
    render(<FilterButtonGroup options={options} value="all" onChange={onChange} />);

    const activeBtn = screen.getByRole("radio", { name: /Active/i });
    fireEvent.click(activeBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("active");
  });

  it("renders correctly in multi-select mode", () => {
    const onChange = vi.fn();
    render(
      <FilterButtonGroup
        multiple
        options={options}
        value={["all", "active"]}
        onChange={onChange}
      />
    );

    const buttons = screen.getAllByRole("checkbox");
    expect(buttons).toHaveLength(3);

    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
    expect(buttons[1].getAttribute("aria-checked")).toBe("true");
    expect(buttons[2].getAttribute("aria-checked")).toBe("false");
  });

  it("handles multi-select toggles correctly", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterButtonGroup multiple options={options} value={["all"]} onChange={onChange} />
    );

    // Select a new option
    const activeBtn = screen.getByRole("checkbox", { name: /Active/i });
    fireEvent.click(activeBtn);

    expect(onChange).toHaveBeenCalledWith(["all", "active"]);

    // Deselect an existing option
    rerender(
      <FilterButtonGroup multiple options={options} value={["all", "active"]} onChange={onChange} />
    );
    const allBtn = screen.getByRole("checkbox", { name: /All/i });
    fireEvent.click(allBtn);

    expect(onChange).toHaveBeenCalledWith(["active"]);
  });

  it("ignores clicks on disabled options", () => {
    const onChange = vi.fn();
    const optsWithDisabled = [
      ...options,
      { value: "archived", label: "Archived", disabled: true },
    ];

    render(<FilterButtonGroup options={optsWithDisabled} value="all" onChange={onChange} />);

    const archivedBtn = screen.getByRole("radio", { name: /Archived/i });
    expect((archivedBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(archivedBtn);
    expect(onChange).not.toHaveBeenCalled();
  });
});
