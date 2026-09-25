import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { usePosSession, PosProviders } from "./providers/PosProviders.js";
import { PosRouter } from "./router.js";

vi.mock("./pages/CheckoutPage.js", () => ({
  CheckoutPage: (): React.JSX.Element => <div>checkout-page</div>,
}));

vi.mock("./showcase/ShowcaseView.js", () => ({
  ShowcaseView: (): React.JSX.Element => <div>showcase-page</div>,
}));

vi.mock("./pages/LoginPage.js", () => ({
  LoginPage: (): React.JSX.Element => <div>login-page</div>,
}));

vi.mock("./pages/LockScreen.js", () => ({
  LockScreen: (): React.JSX.Element => <div />,
}));

function SignInHelper(): React.JSX.Element {
  const { signIn } = usePosSession();
  return (
    <button onClick={(): void => signIn({ staffId: "s-1", name: "Mina", role: "Manager" })}>
      helper-signin
    </button>
  );
}

describe("PosRouter", () => {
  it("redirects unauthenticated users to login", async () => {
    render(
      <PosProviders>
        <PosRouter />
      </PosProviders>,
    );
    expect(await screen.findByText("login-page")).toBeDefined();
  });

  it("navigates signed-in sessions between checkout and demo", async () => {
    render(
      <PosProviders>
        <SignInHelper />
        <PosRouter />
      </PosProviders>,
    );
    fireEvent.click(await screen.findByText("helper-signin"));
    expect(await screen.findByRole("button", { name: "Demo" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(await screen.findByText("showcase-page")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
    expect(await screen.findByText("checkout-page")).toBeDefined();
  });
});
