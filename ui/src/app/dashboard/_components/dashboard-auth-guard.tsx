"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useGoogleSession } from "@/hooks/use-google-session";

// Static export - there's no server to redirect an unauthenticated request
// before it ever reaches the browser, so this is a client-side gate: render
// nothing but a loading state until the session check resolves, then either
// redirect home (never rendering the real dashboard) or show it.
export function DashboardAuthGuard({ children }: { readonly children: React.ReactNode }) {
  const { user, loading } = useGoogleSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
