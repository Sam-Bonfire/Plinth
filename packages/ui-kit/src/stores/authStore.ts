import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthTokens {
  token: string;
  expiresIn: number;
  issuedAt: string;
}

export interface TenantContext {
  tenantId: string | null;
  locationId: string | null;
  terminalId: string | null;
}

export interface StaffIdentity {
  staffId: string;
  role: string;
  permissions: number;
}

export interface AuthState {
  tokens: AuthTokens | null;
  staff: StaffIdentity | null;
  tenantContext: TenantContext;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setSession: (tokens: AuthTokens, staff: StaffIdentity, tenantContext: TenantContext) => void;
  setTenantContext: (ctx: Partial<TenantContext>) => void;
  clearSession: () => void;
  setToken: (token: string | null) => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  tokens: null,
  staff: null,
  tenantContext: {
    tenantId: null,
    locationId: null,
    terminalId: null,
  },
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,
      setSession: (tokens: AuthTokens, staff: StaffIdentity, tenantContext: TenantContext): void => {
        set({
          tokens,
          staff,
          tenantContext,
          isAuthenticated: true,
        });
      },
      setTenantContext: (ctx: Partial<TenantContext>): void => {
        const current = useAuthStore.getState().tenantContext;
        set({
          tenantContext: { ...current, ...ctx },
        });
      },
      clearSession: (): void => {
        set({ ...initialState });
      },
      setToken: (token: string | null): void => {
        if (token === null) {
          set({ tokens: null, isAuthenticated: false });
          return;
        }
        const currentTokens = useAuthStore.getState().tokens;
        const tokens: AuthTokens = currentTokens
          ? { ...currentTokens, token }
          : { token, expiresIn: 3600, issuedAt: new Date().toISOString() };
        set({ tokens, isAuthenticated: true });
      },
    }),
    {
      name: "plinth-auth-store",
      storage: createJSONStorage(() => {
        if (typeof localStorage !== "undefined") {
          return localStorage;
        }
        const mem = new Map<string, string>();
        return {
          getItem: (key: string): string | null => mem.get(key) ?? null,
          setItem: (key: string, value: string): void => {
            mem.set(key, value);
          },
          removeItem: (key: string): void => {
            mem.delete(key);
          },
        } as Storage;
      }),
      partialize: (state: AuthStore): Partial<AuthStore> => ({
        tokens: state.tokens,
        staff: state.staff,
        tenantContext: state.tenantContext,
        isAuthenticated: state.isAuthenticated,
      }),
    } as never,
  ),
);

export function selectAuthHeaders(state: AuthStore): Record<string, string> {
  const headers: Record<string, string> = {};
  if (state.tokens?.token) {
    headers.Authorization = `Bearer ${state.tokens.token}`;
  }
  if (state.tenantContext.tenantId) {
    headers["x-tenant-id"] = state.tenantContext.tenantId;
  }
  if (state.tenantContext.locationId) {
    headers["x-location-id"] = state.tenantContext.locationId;
  }
  return headers;
}
