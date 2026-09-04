"use client";

import { useCallback, useEffect, useState } from "react";

export interface SessionUser {
  readonly email: string;
  readonly name: string;
  readonly picture: string;
}

export function useGoogleSession() {
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

  return { user, loading, logout, refetch };
}
