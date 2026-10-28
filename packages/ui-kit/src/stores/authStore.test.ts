import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, selectAuthHeaders } from "./authStore.js";

const staff = { staffId: "staff-1", role: "Manager", permissions: 15 };
const tenant = { tenantId: "tenant-1", locationId: "loc-1", terminalId: "term-1" };

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("sets the session and builds context headers", () => {
    useAuthStore.getState().setSession(staff, tenant);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.staff?.staffId).toBe("staff-1");
    const headers = selectAuthHeaders(state);
    expect(headers).not.toHaveProperty("Authorization");
    expect(headers["x-tenant-id"]).toBe("tenant-1");
    expect(headers["x-location-id"]).toBe("loc-1");
  });

  it("updates tenant context partially", () => {
    useAuthStore.getState().setSession(staff, { tenantId: "t1", locationId: "l1", terminalId: null });
    useAuthStore.getState().setTenantContext({ locationId: "l2" });
    expect(useAuthStore.getState().tenantContext.locationId).toBe("l2");
    expect(useAuthStore.getState().tenantContext.tenantId).toBe("t1");
  });

  it("clears the session", () => {
    useAuthStore.getState().setSession(staff, tenant);
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.staff).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("keeps no credential material in state", () => {
    useAuthStore.getState().setSession(staff, tenant);
    const state = useAuthStore.getState();
    expect(state).not.toHaveProperty("tokens");
    expect(JSON.stringify(state)).not.toContain("Bearer");
  });
});
