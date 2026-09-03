import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, selectAuthHeaders } from "./authStore.js";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("sets session and builds auth headers", () => {
    useAuthStore.getState().setSession(
      { token: "jwt-123", expiresIn: 3600, issuedAt: new Date().toISOString() },
      { staffId: "staff-1", role: "Manager", permissions: 15 },
      { tenantId: "tenant-1", locationId: "loc-1", terminalId: "term-1" },
    );
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.staff?.staffId).toBe("staff-1");
    const headers = selectAuthHeaders(state);
    expect(headers.Authorization).toBe("Bearer jwt-123");
    expect(headers["x-tenant-id"]).toBe("tenant-1");
    expect(headers["x-location-id"]).toBe("loc-1");
  });

  it("updates tenant context partially", () => {
    useAuthStore.getState().setSession(
      { token: "tok", expiresIn: 3600, issuedAt: new Date().toISOString() },
      { staffId: "s1", role: "Cashier", permissions: 1 },
      { tenantId: "t1", locationId: "l1", terminalId: null },
    );
    useAuthStore.getState().setTenantContext({ locationId: "l2" });
    expect(useAuthStore.getState().tenantContext.locationId).toBe("l2");
    expect(useAuthStore.getState().tenantContext.tenantId).toBe("t1");
  });

  it("clears session and handles token null", () => {
    useAuthStore.getState().setSession(
      { token: "tok", expiresIn: 3600, issuedAt: new Date().toISOString() },
      { staffId: "s1", role: "Cashier", permissions: 1 },
      { tenantId: "t1", locationId: "l1", terminalId: null },
    );
    useAuthStore.getState().setToken(null);
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("sets token when no prior tokens", () => {
    useAuthStore.getState().setToken("new-jwt");
    expect(useAuthStore.getState().tokens?.token).toBe("new-jwt");
  });
});
