import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { FormRow } from "./FormRow";

describe("FormRow", () => {
  it("renders label and children", () => {
    render(
      <FormRow label="Row Label">
        <input data-testid="row-input" />
      </FormRow>
    );

    expect(screen.getByText("Row Label")).toBeDefined();
    expect(screen.getByTestId("row-input")).toBeDefined();
  });
});
