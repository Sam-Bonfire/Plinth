import { useAuthStore } from "@plinth/ui-kit";
import { PlinthApiClient } from "@plinth/ui-kit";
import React, { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from "react";

export interface AuthContextValue {
  isAuthenticated: boolean;
  isRestoring: boolean;
  tenantId: string | null;
  locationId: string | null;
  login: (staffId: string, pin: string) => Promise<void>;
  logout: () => void;
  client: PlinthApiClient;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};

const baseUrl = (): string =>
  (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_BASE_URL ??
  "http://localhost:8787";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantContext, isAuthenticated, setSession, clearSession } = useAuthStore();
  const [isRestoring, setIsRestoring] = useState<boolean>(true);

  const client = useMemo(() => new PlinthApiClient({ baseUrl: baseUrl() }), []);

  // The session cookie is the source of truth: ask the edge who we are on load.
  useEffect(() => {
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const session = await client.getSession();
        if (!active) return;
        setSession(
          { staffId: session.staff_id, role: session.role, permissions: session.permissions },
          {
            tenantId: session.tenant_id ?? null,
            locationId: session.location_id ?? null,
            terminalId: null,
          },
        );
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setIsRestoring(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [client, setSession, clearSession]);

  const login = useCallback(
    async (staffId: string, pin: string): Promise<void> => {
      client.setTenantContext(tenantContext.tenantId, tenantContext.locationId);
      const res = await client.login({ staff_id: staffId, pin });
      setSession(
        { staffId: res.staff_id, role: res.role, permissions: res.permissions },
        {
          tenantId: res.tenant_id ?? tenantContext.tenantId,
          locationId: res.location_id ?? tenantContext.locationId,
          terminalId: tenantContext.terminalId,
        },
      );
    },
    [client, setSession, tenantContext],
  );

  const logout = useCallback((): void => {
    void client.logout().catch(() => {
      // The local session is cleared either way; a failed revoke must not trap the user.
    });
    clearSession();
  }, [client, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isRestoring,
      tenantId: tenantContext.tenantId,
      locationId: tenantContext.locationId,
      login,
      logout,
      client,
    }),
    [isAuthenticated, isRestoring, tenantContext.tenantId, tenantContext.locationId, login, logout, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
