import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PosProviders } from "./PosProviders.js";
import { usePosSession } from "./PosSessionProvider.js";

function Probe(): React.JSX.Element {
  const { session, signIn, signOut } = usePosSession();
  return (
    <div>
      <div>{session ? `signed:${session.name}` : "signed-out"}</div>
      <button onClick={(): void => signIn({ staffId: "s-1", name: "Mina", role: "Manager" })}>in</button>
      <button onClick={signOut}>out</button>
    </div>
  );
}

describe("PosProviders", () => {
  it("provides session sign-in and sign-out", async () => {
    render(
      <PosProviders>
        <Probe />
      </PosProviders>,
    );
    expect(await screen.findByText("signed-out")).toBeDefined();
    fireEvent.click(await screen.findByText("in"));
    expect(await screen.findByText("signed:Mina")).toBeDefined();
    fireEvent.click(await screen.findByText("out"));
    expect(await screen.findByText("signed-out")).toBeDefined();
  });

  it("throws outside the provider", () => {
    function Outside(): React.JSX.Element {
      usePosSession();
      return <div>unreachable</div>;
    }
    expect(() => render(<Outside />)).toThrow("usePosSession must be within PosSessionProvider");
  });
});
