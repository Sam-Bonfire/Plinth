import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  staff: StaffIdentity | null;
  tenantContext: TenantContext;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setSession: (staff: StaffIdentity, tenantContext: TenantContext) => void;
  setTenantContext: (ctx: Partial<TenantContext>) => void;
  clearSession: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  staff: null,
  tenantContext: {
    tenantId: null,
    locationId: null,
    terminalId: null,
  },
  isAuthenticated: false,
};

/**
 * Session state only: the tokens themselves live in HttpOnly cookies, so no
 * credential material is persisted here or anywhere else in page storage.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,
      setSession: (staff: StaffIdentity, tenantContext: TenantContext): void => {
        set({
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
        staff: state.staff,
        tenantContext: state.tenantContext,
        isAuthenticated: state.isAuthenticated,
      }),
    } as never,
  ),
);

export function selectAuthHeaders(state: AuthStore): Record<string, string> {
  const headers: Record<string, string> = {};
  if (state.tenantContext.tenantId) {
    headers["x-tenant-id"] = state.tenantContext.tenantId;
  }
  if (state.tenantContext.locationId) {
    headers["x-location-id"] = state.tenantContext.locationId;
  }
  return headers;
}
