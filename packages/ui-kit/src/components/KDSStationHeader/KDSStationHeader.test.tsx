import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KDSStationHeader } from "./KDSStationHeader.js";

describe("KDSStationHeader", () => {
  it("renders station name and open count", () => {
    render(<KDSStationHeader station="Tandoor" openCount={4} />);
    expect(screen.getByTestId("kds-station-header")).toBeDefined();
    expect(screen.getByText("Tandoor")).toBeDefined();
    expect(screen.getByText("· 4 open")).toBeDefined();
  });

  it("shows late tag when tickets are late", () => {
    render(<KDSStationHeader station="Grill" openCount={3} lateCount={2} />);
    expect(screen.getByTestId("kds-station-late")).toBeDefined();
    expect(screen.getByText("2 late")).toBeDefined();
  });

  it("hides late tag when nothing is late", () => {
    render(<KDSStationHeader station="Fryer" openCount={1} lateCount={0} />);
    expect(screen.queryByTestId("kds-station-late")).toBeNull();
  });
});
