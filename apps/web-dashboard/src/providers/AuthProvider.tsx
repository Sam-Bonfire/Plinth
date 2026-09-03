import { useAuthStore } from "@plinth/ui-kit";
import { PlinthApiClient } from "@plinth/ui-kit";
import React, { createContext, useContext, useCallback, useMemo, ReactNode } from "react";

export interface AuthContextValue {
  isAuthenticated: boolean;
  tenantId: string | null;
  locationId: string | null;
  login: (staffId: string, pin: string) => Promise<void>;
  logout: () => void;
  client: PlinthApiClient;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tokens, staff, tenantContext, isAuthenticated, setSession, clearSession } = useAuthStore();

  const client = useMemo(
    () =>
      new PlinthApiClient({
        baseUrl:
          (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_BASE_URL ??
          "http://localhost:8787",
        token: tokens?.token ?? null,
        tenantId: tenantContext.tenantId,
        locationId: tenantContext.locationId,
      }),
    [tokens?.token, tenantContext.tenantId, tenantContext.locationId],
  );

  const login = useCallback(
    async (staffId: string, pin: string): Promise<void> => {
      const res = await client.login({ staff_id: staffId, pin });
      setSession(
        { token: res.token, expiresIn: res.expires_in, issuedAt: new Date().toISOString() },
        { staffId: res.staff_id, role: res.role, permissions: res.permissions },
        tenantContext,
      );
      void staff;
    },
    [client, setSession, tenantContext],
  );

  const logout = useCallback((): void => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      tenantId: tenantContext.tenantId,
      locationId: tenantContext.locationId,
      login,
      logout,
      client,
    }),
    [isAuthenticated, tenantContext.tenantId, tenantContext.locationId, login, logout, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
