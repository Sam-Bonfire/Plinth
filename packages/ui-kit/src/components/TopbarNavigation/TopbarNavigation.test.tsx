import { render, screen } from "@testing-library/react";
import { Button } from "antd";
import { describe, expect, it } from "vitest";
import { TopbarNavigation } from "./TopbarNavigation.js";

describe("TopbarNavigation", () => {
  it("renders title and sub", () => {
    render(<TopbarNavigation title="Orders" sub="Live order pipeline" />);
    expect(screen.getByTestId("topbar-title")).toBeDefined();
    expect(screen.getByText("Live order pipeline")).toBeDefined();
  });

  it("renders actions slot", () => {
    render(<TopbarNavigation title="Orders" actions={<Button>New Order</Button>} />);
    expect(screen.getByTestId("topbar-actions")).toBeDefined();
    expect(screen.getByText("New Order")).toBeDefined();
  });

  it("omits optional slots when not provided", () => {
    render(<TopbarNavigation title="Orders" />);
    expect(screen.queryByTestId("topbar-actions")).toBeNull();
    expect(screen.queryByText("Live order pipeline")).toBeNull();
  });
});
