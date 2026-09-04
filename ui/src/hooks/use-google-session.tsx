"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface SessionUser {
  readonly email: string;
  readonly name: string;
  readonly picture: string;
}

interface GoogleSessionValue {
  user: SessionUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const GoogleSessionContext = createContext<GoogleSessionValue | null>(null);

// Single fetch + single piece of state shared by every consumer (NavUser,
// AccountSwitcher, DashboardAuthGuard, the landing page CTAs, ...). Without
// this, each component's own useState never learns about a logout/login
// triggered from a different component - e.g. clicking Log out in NavUser
// wouldn't update DashboardAuthGuard's copy, so it would never redirect.
export function GoogleSessionProvider({ children }: { readonly children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google/session", { credentials: "include" });
      const data = (await res.json()) as { user: SessionUser | null };
      setUser(res.ok ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/google/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <GoogleSessionContext.Provider value={{ user, loading, logout, refetch }}>
      {children}
    </GoogleSessionContext.Provider>
  );
}

export function useGoogleSession(): GoogleSessionValue {
  const ctx = useContext(GoogleSessionContext);
  if (!ctx) {
    throw new Error("useGoogleSession must be used within a GoogleSessionProvider");
  }
  return ctx;
}
