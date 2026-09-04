import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { PlinthDataTable } from "./PlinthDataTable.js";
import type { PlinthColumnType } from "./PlinthDataTable.js";

// Note: Ensure Vitest native matchers are used

interface TestData {
  id: string;
  name: string;
  category: string;
}

const mockData: TestData[] = [
  { id: "1", name: "Apple", category: "Fruit" },
  { id: "2", name: "Banana", category: "Fruit" },
  { id: "3", name: "Carrot", category: "Vegetable" },
];

const mockColumns: PlinthColumnType<TestData>[] = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Name", dataIndex: "name", key: "name", searchable: true },
  { title: "Category", dataIndex: "category", key: "category", searchable: true },
];

describe("PlinthDataTable", () => {
  it("renders columns and data correctly", () => {
    render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
      />
    );

    // Verify columns
    expect(screen.getAllByText("ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Category").length).toBeGreaterThan(0);

    // Verify data
    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carrot").length).toBeGreaterThan(0);
  });

  it("filters data when searchable is true and text is entered", () => {
    render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
        searchable
      />
    );

    const searchInput = screen.getByRole("searchbox");
    expect(searchInput).toBeDefined();

    // Search for "Apple"
    fireEvent.change(searchInput, { target: { value: "Apple" } });

    // Apple should be visible
    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);

    // Other rows should not be visible
    expect(screen.queryByText("Banana")).toBeNull();
    expect(screen.queryByText("Carrot")).toBeNull();
  });

  it("filters data using multiple searchable columns", () => {
    render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
        searchable
      />
    );

    const searchInput = screen.getByRole("searchbox");

    // Search for "Fruit"
    fireEvent.change(searchInput, { target: { value: "Fruit" } });

    // Apple and Banana should be visible
    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);

    // Carrot should not be visible
    expect(screen.queryByText("Carrot")).toBeNull();
  });

  it("calls onExport with filtered data when Export button is clicked", () => {
    const handleExport = vi.fn();

    render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
        searchable
        onExport={handleExport}
      />
    );

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Banana" } });

    const exportButton = screen.getByText("Export");
    fireEvent.click(exportButton);

    expect(handleExport).toHaveBeenCalledTimes(1);
    expect(handleExport).toHaveBeenCalledWith([mockData[1]]); // Only Banana
  });

  it("applies correct density classes", () => {
    const { container: containerComfortable } = render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
        density="comfortable"
      />
    );
    expect(containerComfortable.querySelector(".density-comfortable")).toBeDefined();

    const { container: containerCompact } = render(
      <PlinthDataTable
        dataSource={mockData}
        columns={mockColumns}
        rowKey="id"
        density="compact"
      />
    );
    expect(containerCompact.querySelector(".density-compact")).toBeDefined();
  });

  it("renders custom empty text when data is empty", () => {
    render(
      <PlinthDataTable
        dataSource={[]}
        columns={mockColumns}
        rowKey="id"
        emptyText="No items found"
      />
    );

    expect(screen.getAllByText("No items found").length).toBeGreaterThan(0);
  });

  it("renders with proper accessibility roles", () => {
     render(
       <PlinthDataTable
         dataSource={mockData}
         columns={mockColumns}
         rowKey="id"
       />
     );

     const tables = screen.getAllByRole("table");
     expect(tables.length).toBeGreaterThan(0);

     // The table has a header and a body role group
     const rowgroups = screen.getAllByRole("rowgroup");
     expect(rowgroups.length).toBeGreaterThan(0);
  });
});
