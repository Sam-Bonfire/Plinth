import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isStepComplete, OnboardingWizard } from "./OnboardingWizard.js";

describe("isStepComplete", () => {
  it("validates required steps and passes optional ones", () => {
    const base = { storeName: "S", city: "C", gstRate: 5, ownerPin: "1234" };
    expect(isStepComplete(0, { ...base, storeName: "  " })).toBe(false);
    expect(isStepComplete(1, { ...base, city: "" })).toBe(false);
    expect(isStepComplete(2, { ...base, gstRate: null })).toBe(false);
    expect(isStepComplete(3, { ...base, ownerPin: "12" })).toBe(false);
    expect(isStepComplete(0, base)).toBe(true);
    expect(isStepComplete(4, base)).toBe(true);
    expect(isStepComplete(6, base)).toBe(true);
  });
});

describe("OnboardingWizard", () => {
  it("walks the steps and finishes", async () => {
    localStorage.clear();
    render(<OnboardingWizard />);
    fireEvent.change(screen.getByPlaceholderText("Store name"), { target: { value: "Test Cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByPlaceholderText("City")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("City"), { target: { value: "Bengaluru" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByPlaceholderText("GST %")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("GST %"), { target: { value: 5 } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByPlaceholderText("Owner PIN (min 4 chars)")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("Owner PIN (min 4 chars)"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish Setup" }));
    expect(await screen.findByText("Welcome aboard, Test Cafe!")).toBeDefined();
    localStorage.clear();
  }, 60000);

  it("blocks next on empty required fields", async () => {
    localStorage.clear();
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Fill the required field to continue.")).toBeDefined();
    localStorage.clear();
  }, 60000);
});
