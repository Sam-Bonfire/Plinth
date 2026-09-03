import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type LocaleCode = "en" | "hi";

export interface UiState {
  themeMode: ThemeMode;
  locale: LocaleCode;
  sidebarCollapsed: boolean;
  isDarkResolved: boolean;
}

export interface UiActions {
  setThemeMode: (mode: ThemeMode) => void;
  setLocale: (locale: LocaleCode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDarkResolved: (isDark: boolean) => void;
}

export type UiStore = UiState & UiActions;

const initialState: UiState = {
  themeMode: "light",
  locale: "en",
  sidebarCollapsed: false,
  isDarkResolved: false,
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      ...initialState,
      setThemeMode: (mode: ThemeMode): void => {
        set({ themeMode: mode });
      },
      setLocale: (locale: LocaleCode): void => {
        set({ locale });
      },
      toggleSidebar: (): void => {
        const current = useUiStore.getState().sidebarCollapsed;
        set({ sidebarCollapsed: !current });
      },
      setSidebarCollapsed: (collapsed: boolean): void => {
        set({ sidebarCollapsed: collapsed });
      },
      setDarkResolved: (isDark: boolean): void => {
        set({ isDarkResolved: isDark });
      },
    }),
    {
      name: "plinth-ui-store",
      storage: createJSONStorage(() => {
        if (typeof localStorage !== "undefined") {
          return localStorage;
        }
        // In-memory fallback for test/SSR environments
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
      partialize: (state: UiStore): Partial<UiStore> => ({
        themeMode: state.themeMode,
        locale: state.locale,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    } as never,
  ),
);

export function getIsDark(themeMode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return systemPrefersDark;
}
