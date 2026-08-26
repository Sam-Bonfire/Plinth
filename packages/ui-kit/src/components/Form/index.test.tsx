
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormSection, FormRow } from "./index.js";

describe("FormSection", () => {
  it("renders title, description, and children", () => {
    render(
      <FormSection title="Section Title" description="Section Description">
        <div data-testid="section-content">Section Content</div>
      </FormSection>
    );

    expect(screen.getByText("Section Title")).toBeDefined();
    expect(screen.getByText("Section Description")).toBeDefined();
    expect(screen.getByTestId("section-content")).toBeDefined();
  });
});

describe("FormRow", () => {
  it("renders label and children", () => {
    render(
      <FormRow label="Row Label">
        <div data-testid="row-content">Row Content</div>
      </FormRow>
    );

    expect(screen.getByText("Row Label")).toBeDefined();
    expect(screen.getByTestId("row-content")).toBeDefined();
  });
});
