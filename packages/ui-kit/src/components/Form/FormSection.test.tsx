import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { FormSection } from "./FormSection";

describe("FormSection", () => {
  it("renders title and children", () => {
    render(
      <FormSection title="Section Title">
        <div data-testid="section-content">Content</div>
      </FormSection>
    );

    expect(screen.getByText("Section Title")).toBeDefined();
    expect(screen.getByTestId("section-content")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(
      <FormSection title="Title" description="Section description">
        <div>Content</div>
      </FormSection>
    );

    expect(screen.getByText("Section description")).toBeDefined();
  });

  it("can hide the divider", () => {
    const { container } = render(
      <FormSection title="Title" hideDivider={true}>
        <div>Content</div>
      </FormSection>
    );

    // Ant Design's Divider component usually renders with class 'ant-divider'
    expect(container.querySelector(".ant-divider")).toBeNull();
  });

  it("shows the divider by default", () => {
    const { container } = render(
      <FormSection title="Title">
        <div>Content</div>
      </FormSection>
    );

    expect(container.querySelector(".ant-divider")).not.toBeNull();
  });
});
