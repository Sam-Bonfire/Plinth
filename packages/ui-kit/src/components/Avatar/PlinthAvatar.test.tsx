import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { PlinthAvatar } from "./PlinthAvatar";

describe("PlinthAvatar", () => {
  it("renders correctly with initials from single word name", () => {
    render(<PlinthAvatar name="Alice" data-testid="avatar" />);
    const avatar = screen.getByText("AL");
    expect(avatar).toBeDefined();
  });

  it("renders correctly with initials from multi-word name", () => {
    render(<PlinthAvatar name="Alice Bob" data-testid="avatar" />);
    const avatar = screen.getByText("AB");
    expect(avatar).toBeDefined();
  });

  it("renders correctly with initials from more than two words", () => {
    render(<PlinthAvatar name="Alice Bob Charlie" data-testid="avatar" />);
    const avatar = screen.getByText("AC");
    expect(avatar).toBeDefined();
  });

  it("renders image if src is provided instead of initials", () => {
    render(<PlinthAvatar name="Alice Bob" src="http://example.com/alice.png" data-testid="avatar" />);
    const image = screen.getByRole("img");
    expect(image).toBeDefined();
    expect(image.getAttribute("src")).toBe("http://example.com/alice.png");
    const textNode = screen.queryByText("AB");
    expect(textNode).toBeNull();
  });

  it("generates deterministic background color", () => {
    const { container: container1 } = render(<PlinthAvatar name="Alice" />);
    const avatar1 = container1.querySelector('.ant-avatar');
    expect(avatar1).not.toBeNull();
    const color1 = avatar1?.getAttribute('style');

    const { container: container2 } = render(<PlinthAvatar name="Alice" />);
    const avatar2 = container2.querySelector('.ant-avatar');
    expect(avatar2).not.toBeNull();
    const color2 = avatar2?.getAttribute('style');

    const { container: container3 } = render(<PlinthAvatar name="Bob" />);
    const avatar3 = container3.querySelector('.ant-avatar');
    expect(avatar3).not.toBeNull();
    const color3 = avatar3?.getAttribute('style');

    // Alice and Alice should match
    expect(color1).toBe(color2);
    // Alice and Bob should probably not match (unless hash collision)
    expect(color1).not.toBe(color3);
  });

  it("renders status badge when status is provided", () => {
    render(<PlinthAvatar name="Alice Bob" status="online" />);
    const badge = screen.getByTestId("status-badge-online");
    expect(badge).toBeDefined();
  });

  it("passes size prop down to Avatar properly", () => {
    const { container } = render(<PlinthAvatar name="Alice" size="lg" />);
    // antd sets style width and height for numeric sizes, and line-height.
    // 'lg' maps to 64px in our component
    const avatar = container.querySelector('.ant-avatar');
    expect(avatar).not.toBeNull();
    const style = avatar?.getAttribute('style');
    expect(style).toContain('width: 64px');
    expect(style).toContain('height: 64px');
  });
});
