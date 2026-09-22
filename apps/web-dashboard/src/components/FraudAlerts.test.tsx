import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FraudAlerts } from "./FraudAlerts.js";

describe("FraudAlerts", () => {
  it("renders an empty state without alerts", async () => {
    render(<FraudAlerts alerts={[]} />);
    expect(await screen.findByText("No open alerts.")).toBeDefined();
  });

  it("lists alerts and counts critical ones", async () => {
    render(
      <FraudAlerts
        alerts={[
          { id: "a-1", kind: "warning", message: "Refund velocity", description: "3 refunds above limit." },
          { id: "a-2", kind: "error", message: "Payout shortfall", description: "Zomato payout is short." },
        ]}
      />,
    );
    expect(await screen.findByText("Refund velocity")).toBeDefined();
    expect(await screen.findByText("Payout shortfall")).toBeDefined();
    expect(await screen.findByText("1 critical")).toBeDefined();
  });
});
