import type { PlinthApiClient } from "@plinth/ui-kit";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AuthContext } from "../providers/AuthProvider.js";
import { TrackingPage, statusToStep } from "./TrackingPage.js";

describe("TrackingPage logic", () => {
  it("statusToStep maps OrderStatus to timeline steps correctly", () => {
    // @ts-expect-error Intentionally testing fallback for unknown status
    expect(statusToStep("InProgress")).toBe(0);
    expect(statusToStep("Preparing")).toBe(1);
    expect(statusToStep("Ready")).toBe(2);
    expect(statusToStep("Served")).toBe(3);
    expect(statusToStep("Settled")).toBe(3);
    expect(statusToStep("Voided")).toBe(-1);
  });
});

describe("TrackingPage component", () => {
  const renderTracking = (mockClientArgs?: Partial<PlinthApiClient>) => {
    return render(
      <AuthContext.Provider
        value={{
          isAuthenticated: true,
          tenantId: "tenant-1",
          locationId: "loc-1",
          login: async (): Promise<void> => {},
          logout: (): void => {},
          client: {
            getPublicOrderStatus: vi.fn().mockResolvedValue({ status: "Preparing" }),
            ...mockClientArgs,
          } as unknown as PlinthApiClient,
        }}
      >
        <TrackingPage />
      </AuthContext.Provider>,
    );
  };

  it("shows invalid order message when order is not found", async () => {
    renderTracking({ getPublicOrderStatus: vi.fn().mockRejectedValue(new Error("API ERROR")) });

    const input = screen.getByPlaceholderText("Enter Order ID");
    fireEvent.change(input, { target: { value: "INVALID-999" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));

    expect(await screen.findByText("Invalid Order ID or unreachable. Please check and try again.")).toBeDefined();
  });

  it("fetches order and displays status", async () => {
    renderTracking({ getPublicOrderStatus: vi.fn().mockResolvedValue({ status: "Ready" }) });
    const input = screen.getByPlaceholderText("Enter Order ID");

    fireEvent.change(input, { target: { value: "ORD-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Track" }));

    expect(await screen.findByRole("heading", { name: "Order ORD-123" })).toBeDefined();
    expect(await screen.findByText("Your order is ready.")).toBeDefined();
  });
});
