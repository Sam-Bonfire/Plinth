import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { BarChart } from "./BarChart.js";
import { ChartContainer } from "./ChartContainer.js";
import { DoughnutChart } from "./DoughnutChart.js";
import { LineChart } from "./LineChart.js";

// Mock matchMedia for ant-design components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Recharts / Ant Design Charts dependencies that rely on canvas
vi.mock('@ant-design/charts', () => ({
  Pie: () => <div data-testid="mock-pie-chart" />,
  Column: () => <div data-testid="mock-column-chart" />,
  Line: () => <div data-testid="mock-line-chart" />
}));

describe("ChartContainer", () => {
  it("renders title and subtitle", () => {
    render(<ChartContainer title="Revenue" subtitle="Year to date">Content</ChartContainer>);
    expect(screen.getByText("Revenue")).toBeDefined();
    expect(screen.getByText("Year to date")).toBeDefined();
    expect(screen.getByText("Content")).toBeDefined();
  });

  it("renders empty state when isEmpty is true", () => {
    render(<ChartContainer isEmpty>Content</ChartContainer>);
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
    expect(screen.getByText("No data available")).toBeDefined();
    expect(screen.queryByText("Content")).toBeNull();
  });
});

describe("DoughnutChart", () => {
  it("renders empty state when data is empty", () => {
    render(<DoughnutChart data={[]} angleField="value" colorField="type" />);
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
  });

  it("renders chart when data is provided", () => {
    const data = [{ type: 'A', value: 10 }];
    render(<DoughnutChart data={data} angleField="value" colorField="type" />);
    expect(screen.getByTestId("mock-pie-chart")).toBeDefined();
  });
});

describe("BarChart", () => {
  it("renders empty state when data is empty", () => {
    render(<BarChart data={[]} xField="month" yField="value" />);
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
  });

  it("renders chart when data is provided", () => {
    const data = [{ month: 'Jan', value: 10 }];
    render(<BarChart data={data} xField="month" yField="value" />);
    expect(screen.getByTestId("mock-column-chart")).toBeDefined();
  });
});

describe("LineChart", () => {
  it("renders empty state when data is empty", () => {
    render(<LineChart data={[]} xField="month" yField="value" />);
    expect(screen.getByTestId("chart-empty-state")).toBeDefined();
  });

  it("renders chart when data is provided", () => {
    const data = [{ month: 'Jan', value: 10 }];
    render(<LineChart data={data} xField="month" yField="value" />);
    expect(screen.getByTestId("mock-line-chart")).toBeDefined();
  });
});
