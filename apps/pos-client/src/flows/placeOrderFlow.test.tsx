import type { MenuItem } from "@plinth/ui-kit";
import * as tauriApiCore from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutPage } from "../pages/CheckoutPage.js";
import { PosProviders, usePosSession } from "../providers/PosProviders.js";
import { usePosCartStore } from "../stores/posCart.js";
import React from "react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const MENU_ITEM: MenuItem = {
  id: "MI-001",
  name: "Butter Chicken",
  price: 320,
  gstRate: 5,
  isVeg: false,
  categoryId: "CAT-1",
  isAvailable: true,
  modifierGroups: [{ name: "Spice level", options: [{ name: "Medium" }] }],
};

function SignInHelper(): React.JSX.Element {
  const { signIn } = usePosSession();
  return (
    <button onClick={(): void => signIn({ staffId: "s-1", name: "Mina", role: "Manager" })}>
      helper-signin
    </button>
  );
}

function renderCheckout(): void {
  render(
    <PosProviders>
      <SignInHelper />
      <MemoryRouter initialEntries={["/checkout"]}>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    </PosProviders>,
  );
}

describe("POS order placement flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePosCartStore.getState().clear();
  });

  it("rejects items missing required variants before checkout", () => {
    const result = usePosCartStore.getState().addToCart(MENU_ITEM, {});
    expect(result.ok).toBe(false);
    expect(usePosCartStore.getState().lines).toHaveLength(0);
  });

  it("places a variant-complete cart through checkout", async () => {
    vi.mocked(tauriApiCore.invoke).mockResolvedValueOnce("order-flow-1");
    const added = usePosCartStore.getState().addToCart(MENU_ITEM, { "Spice level": "Medium" });
    expect(added.ok).toBe(true);

    renderCheckout();
    fireEvent.click(await screen.findByText("helper-signin"));
    fireEvent.change(screen.getByPlaceholderText("tenant uuid"), { target: { value: "t-1" } });
    fireEvent.change(screen.getByPlaceholderText("location uuid"), { target: { value: "l-1" } });
    fireEvent.change(screen.getByPlaceholderText("terminal uuid"), { target: { value: "term-1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Place Order" }));

    expect(await screen.findByText(/Last order: order-flow-1/)).toBeDefined();
    expect(tauriApiCore.invoke).toHaveBeenCalledWith(
      "submit_order",
      expect.objectContaining({
        req: expect.objectContaining({
          created_by: "s-1",
          items: [
            expect.objectContaining({ menu_item_id: "MI-001", quantity: 1 }),
          ],
        }),
      }),
    );
    expect(usePosCartStore.getState().lines).toHaveLength(0);
  });
});
