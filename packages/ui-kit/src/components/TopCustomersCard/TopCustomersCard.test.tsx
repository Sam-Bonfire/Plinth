import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopCustomersCard } from "./TopCustomersCard.js";

const customers = [
  { name: "Aarav Sharma", orders: 48, spend: 18420 },
  { name: "Meera S", orders: 7, spend: 619.5 },
];

describe("TopCustomersCard", () => {
  it("renders customers with orders and spend", () => {
    render(<TopCustomersCard customers={customers} />);
    expect(screen.getByTestId("top-customers-card")).toBeDefined();
    expect(screen.getByText("Aarav Sharma")).toBeDefined();
    expect(screen.getByText("48 orders")).toBeDefined();
    expect(screen.getByText("₹18,420.00")).toBeDefined();
    expect(screen.getByText("₹619.50")).toBeDefined();
  });

  it("renders empty state", () => {
    render(<TopCustomersCard customers={[]} />);
    expect(screen.getByText("No customers yet.")).toBeDefined();
  });
});
