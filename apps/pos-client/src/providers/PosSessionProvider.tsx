import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface PosStaffSession {
  staffId: string;
  name: string;
  role: string;
}

export interface PosSessionValue {
  session: PosStaffSession | null;
  signIn: (session: PosStaffSession) => void;
  signOut: () => void;
}

const PosSessionContext = createContext<PosSessionValue | undefined>(undefined);

export function usePosSession(): PosSessionValue {
  const ctx = useContext(PosSessionContext);
  if (!ctx) {
    throw new Error("usePosSession must be within PosSessionProvider");
  }
  return ctx;
}

export const PosSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<PosStaffSession | null>(null);

  const signIn = useCallback((next: PosStaffSession): void => {
    setSession(next);
  }, []);

  const signOut = useCallback((): void => {
    setSession(null);
  }, []);

  const value = useMemo<PosSessionValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>;
};
