import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlinthPanel } from "./PlinthPanel.js";

describe("PlinthPanel", () => {
  it("renders content when not collapsed", () => {
    render(<PlinthPanel title="Panel Title">Panel Content</PlinthPanel>);
    expect(screen.getByTestId("plinth-card-body").style.display).not.toBe("none");
    expect(screen.getByTestId("plinth-card-body").textContent).toBe("Panel Content");
  });

  it("hides content when defaultCollapsed is true", () => {
    render(
      <PlinthPanel title="Panel Title" defaultCollapsed>
        Panel Content
      </PlinthPanel>
    );
    expect(screen.getByTestId("plinth-card-body").style.display).toBe("none");
  });

  it("toggles collapse state on click", () => {
    render(<PlinthPanel title="Panel Title">Panel Content</PlinthPanel>);
    const body = screen.getByTestId("plinth-card-body");

    expect(body.style.display).not.toBe("none");

    fireEvent.click(screen.getByTestId("collapse-icon"));
    expect(body.style.display).toBe("none");

    fireEvent.click(screen.getByTestId("panel-title-text"));
    expect(body.style.display).toBe("block");
  });

  it("does not render collapse icon if not collapsible", () => {
    render(<PlinthPanel title="Title" collapsible={false} />);
    expect(screen.queryByTestId("collapse-icon")).toBeNull();
  });
});
