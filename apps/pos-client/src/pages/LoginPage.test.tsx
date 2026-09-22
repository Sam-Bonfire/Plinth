import * as tauriApiCore from "@tauri-apps/api/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PosProviders } from "../providers/PosProviders.js";
import { LoginPage } from "./LoginPage.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function renderLogin(): void {
  render(
    <PosProviders>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/showcase" element={<div>showcase-home</div>} />
        </Routes>
      </MemoryRouter>
    </PosProviders>,
  );
}

describe("LoginPage", () => {
  it("signs in and navigates on valid PIN", async () => {
    vi.mocked(tauriApiCore.invoke).mockResolvedValueOnce({
      staff_id: "s-1",
      name: "Mina",
      role: "Manager",
    });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("e.g. ST-014"), { target: { value: "ST-014" } });
    fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: "4321" } });
    fireEvent.click(await screen.findByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("showcase-home")).toBeDefined();
    expect(tauriApiCore.invoke).toHaveBeenCalledWith("authenticate_pin", { req: { pin: "4321" } });
  });

  it("shows an error on invalid PIN", async () => {
    vi.mocked(tauriApiCore.invoke).mockRejectedValueOnce(new Error("Invalid PIN"));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("e.g. ST-014"), { target: { value: "ST-014" } });
    fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: "0000" } });
    fireEvent.click(await screen.findByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Invalid staff ID or PIN")).toBeDefined();
  });
});
