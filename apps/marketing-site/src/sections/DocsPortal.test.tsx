import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { DocsPortal, filterTopics, DocTopic } from "./DocsPortal.js";
import "@testing-library/jest-dom/vitest";

describe("filterTopics", () => {
  const topics: DocTopic[] = [
    { id: "1", title: "React Basics", content: "Learn components." },
    { id: "2", title: "Advanced TS", content: "Type inference is cool." },
    { id: "3", title: "API Guide", content: "REST and GraphQL." },
  ];

  it("filters by title case-insensitively", () => {
    const result = filterTopics(topics, "react");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("filters by content case-insensitively", () => {
    const result = filterTopics(topics, "inference");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("2");
  });

  it("returns all if query is empty", () => {
    const result = filterTopics(topics, "");
    expect(result).toHaveLength(3);
  });

  it("returns empty if no match", () => {
    const result = filterTopics(topics, "vue");
    expect(result).toHaveLength(0);
  });
});

describe("DocsPortal component", () => {
  it("renders default topics and first topic is selected", () => {
    render(<DocsPortal />);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Getting Started")).toBeInTheDocument();
    expect(within(menu).getByText("API Reference")).toBeInTheDocument();
    expect(within(menu).getByText("Webhooks")).toBeInTheDocument();
    expect(within(menu).getByText("Architecture Whitepaper")).toBeInTheDocument();

    const main = screen.getByRole("main");

    // We can use a custom function for getting by text that allows ignoring whitespace
    expect(within(main).getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'div' && content.includes("Welcome to PlinthOS");
    })).toBeInTheDocument();
  });

  it("changes selected topic on click", () => {
    render(<DocsPortal />);

    const menu = screen.getByRole("menu");
    const apiLink = within(menu).getByText("API Reference");
    fireEvent.click(apiLink);

    const main = screen.getByRole("main");
    expect(within(main).getAllByText("API Reference").length).toBeGreaterThan(0);

    expect(within(main).getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'div' && content.includes("Detailed documentation of all PlinthOS REST endpoints");
    })).toBeInTheDocument();
  });

  it("filters topics when searching", () => {
    render(<DocsPortal />);

    const searchInput = screen.getByPlaceholderText("Search docs...");
    fireEvent.change(searchInput, { target: { value: "REST" } });

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("API Reference")).toBeInTheDocument();

    expect(within(menu).queryByText("Getting Started")).not.toBeInTheDocument();
  });

  it("renders custom content if provided", () => {
    const customContent: DocTopic[] = [
      { id: "custom1", title: "Custom Topic", content: "Custom Content text." },
    ];
    render(<DocsPortal content={customContent} />);

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Custom Topic")).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(within(main).getByText((content, element) => {
       return element?.tagName.toLowerCase() === 'div' && content.includes("Custom Content text.");
    })).toBeInTheDocument();
  });
});
