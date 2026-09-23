import { type MenuItem } from "@plinth/ui-kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MenuCsvWizard } from "./MenuCsvWizard.js";

const mockItems: MenuItem[] = [
  {
    id: "MI-001",
    name: "Burger",
    price: 150,
    categoryId: "CAT-1",
    isAvailable: true,
    gstRate: 5,
    isVeg: false,
    modifierGroups: [],
  },
];

describe("MenuCsvWizard", () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  const renderComponent = (props = {}) => {
    return render(
      <App>
        <MenuCsvWizard
          open={true}
          onClose={vi.fn()}
          items={mockItems}
          onImport={vi.fn()}
          {...props}
        />
      </App>
    );
  };

  it("should render export step initially and handle CSV download", async () => {
    renderComponent();
    // Modal transitions could take a moment
    await waitFor(() => {
      expect(screen.getByText(/Download your current menu as a CSV file/i)).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole("button", { name: "Download CSV" });
    fireEvent.click(downloadBtn);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText("Menu exported successfully.")).toBeInTheDocument();

    // Should automatically move to Import step
    expect(await screen.findByText("Click or drag CSV file to this area to upload")).toBeInTheDocument();
  });

  it("should handle valid CSV import and render preview", async () => {
    const onImportMock = vi.fn();
    renderComponent({ onImport: onImportMock });

    // Wait for the modal to be visible
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip to Import" })).toBeInTheDocument();
    });

    // Go to import step
    fireEvent.click(screen.getByRole("button", { name: "Skip to Import" }));

    const file = new File(
      ["id,name,price,category,is_available\nMI-001,Burger Updated,200,CAT-1,true"],
      "menu.csv",
      { type: "text/csv" }
    );

    // Find the input within the modal
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader because jsdom doesn't fully support it out of the box in some react-testing-library setups without a bit of help,
    // or we can just dispatch the event and wait. Actually, jsdom supports FileReader.
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for the table to appear (preview of items)
    await waitFor(() => {
      expect(screen.getByText("Valid Items to Import (1):")).toBeInTheDocument();
    });

    expect(screen.getByText("Burger Updated")).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    expect(onImportMock).toHaveBeenCalledWith([
      {
        id: "MI-001",
        name: "Burger Updated",
        price: 200,
        categoryId: "CAT-1",
        isAvailable: true,
      },
    ]);
  });

  it("should show errors for invalid CSV import", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skip to Import" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Skip to Import" }));

    const file = new File(
      ["id,name,price,category,is_available\nMI-001,,invalid,CAT-1,true"],
      "menu.csv",
      { type: "text/csv" }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Validation Errors:")).toBeInTheDocument();
    });

    expect(screen.getByText("Row 2: Missing name")).toBeInTheDocument();
  });
});
