import * as tauriApiCore from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosProviders, usePosSession } from "../providers/PosProviders.js";
import { usePosCartStore } from "../stores/posCart.js";
import { CheckoutPage, formatReceipt, tenderChange } from "./CheckoutPage.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../lib/sounds.js", () => ({
  playTone: vi.fn(),
}));

function SignInHelper(): React.JSX.Element {
  const { signIn } = usePosSession();
  return (
    <button onClick={(): void => signIn({ staffId: "s-1", name: "Mina", role: "Manager" })}>
      helper-signin
    </button>
  );
}

function renderPage(): void {
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

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePosCartStore.getState().clear();
  });
  it("places an order through invoke and clears the cart", { timeout: 30000 }, async () => {
    vi.mocked(tauriApiCore.invoke).mockResolvedValueOnce("order-9").mockResolvedValueOnce("print-1");
    usePosCartStore.getState().clear();
    usePosCartStore.setState({
      lines: [
        { key: "l-1", menuItemId: "m-1", name: "Burger", modifiers: [], qty: 2, unitPrice: 200 },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByText("helper-signin"));
    expect(await screen.findByText("Burger")).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("tenant uuid"), { target: { value: "t-1" } });
    fireEvent.change(screen.getByPlaceholderText("location uuid"), { target: { value: "l-1" } });
    fireEvent.change(screen.getByPlaceholderText("terminal uuid"), { target: { value: "term-1" } });
    fireEvent.click(screen.getByRole("radio", { name: "UPI" }));
    fireEvent.click(await screen.findByRole("button", { name: "Place Order" }));
    expect(await screen.findByText(/Last order: order-9/)).toBeDefined();
    expect(tauriApiCore.invoke).toHaveBeenCalledWith(
      "submit_order",
      expect.objectContaining({ req: expect.objectContaining({ terminal_id: "term-1", table_id: null }) }),
    );
    expect(usePosCartStore.getState().lines).toHaveLength(0);
    expect(await screen.findByText("Receipt")).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: "Print" }));
    expect(tauriApiCore.invoke).toHaveBeenCalledWith("print_receipt", expect.objectContaining({}));
    usePosCartStore.getState().clear();
  });

  it("blocks short cash tender before submit", { timeout: 30000 }, async () => {
    usePosCartStore.getState().clear();
    usePosCartStore.setState({
      lines: [
        { key: "l-1", menuItemId: "m-1", name: "Burger", modifiers: [], qty: 1, unitPrice: 200 },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByText("helper-signin"));
    fireEvent.change(screen.getByPlaceholderText("tenant uuid"), { target: { value: "t-1" } });
    fireEvent.change(screen.getByPlaceholderText("location uuid"), { target: { value: "l-1" } });
    fireEvent.change(screen.getByPlaceholderText("terminal uuid"), { target: { value: "term-1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Place Order" }));
    expect(await screen.findByText(/Cash short by/)).toBeDefined();
    expect(tauriApiCore.invoke).not.toHaveBeenCalled();
    usePosCartStore.getState().clear();
  });

  it("computes change and receipt lines", () => {
    expect(tenderChange(400, 500)).toBe(100);
    const lines = formatReceipt("order-9", [{ key: "l-1", menuItemId: "m-1", name: "Burger", modifiers: [], qty: 2, unitPrice: 200 }], 400, 500, 100);
    expect(lines[0]).toBe("PLINTH POS");
    expect(lines.some((l: string): boolean => l.includes("Change: Rs.100"))).toBe(true);
  });

  it("blocks submission without a session", async () => {
    usePosCartStore.getState().clear();
    usePosCartStore.setState({
      lines: [
        { key: "l-1", menuItemId: "m-1", name: "Burger", modifiers: [], qty: 1, unitPrice: 200 },
      ],
    });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("tenant uuid"), { target: { value: "t-1" } });
    fireEvent.change(screen.getByPlaceholderText("location uuid"), { target: { value: "l-1" } });
    fireEvent.change(screen.getByPlaceholderText("terminal uuid"), { target: { value: "term-1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Place Order" }));
    expect(await screen.findByText("Sign in first")).toBeDefined();
    expect(tauriApiCore.invoke).not.toHaveBeenCalled();
    usePosCartStore.getState().clear();
  });
});
