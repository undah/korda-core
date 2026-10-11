// src/auth/beheerder.tsx — which Korda apps this account may open, and who's admin.
//
// Anyone can make an account (KordaBudget's magic link) and use Budget,
// Tracker and Trading. Outreach, CRM and Training are given per person in
// korda_app_toegang; admins (korda_admins) manage that at /admin. See
// supabase/suite_toegang.sql. The database and /api/outreach enforce it;
// this only keeps the screens from showing an app that would load empty.
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "./AuthProvider";

export type BeperkteApp = "outreach" | "crm" | "training";
export const BEPERKTE_APPS: BeperkteApp[] = ["outreach", "crm", "training"];

/** The restricted apps this account has; undefined while loading or signed out. */
export function useMijnApps(): Set<BeperkteApp> | undefined {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["korda_mijn_apps", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<BeperkteApp[]> => {
      const { data, error } = await supabase.rpc("korda_mijn_apps");
      // Before suite_toegang.sql has run there's nothing to check against:
      // everyone had every app then, so the screens behave as before.
      if (error) return BEPERKTE_APPS;
      return (data as BeperkteApp[] | null) ?? [];
    },
  });
  return user && data ? new Set(data) : undefined;
}

/** true / false once known; undefined while loading or signed out. */
export function useIsAdmin(): boolean | undefined {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["korda_is_admin", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("korda_is_admin");
      return !error && data === true;
    },
  });
  return user ? data : undefined;
}

function Wachten() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

function Gesloten({ titel, tekst }: { titel: string; tekst: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080809] px-6 text-center text-[#e8e6e1]">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">{titel}</p>
        <p className="mt-2 text-sm text-white/55">{tekst}</p>
        <Link to="/" className="mt-6 inline-block border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
          Back to the suite
        </Link>
      </div>
    </div>
  );
}

/** Wraps a restricted app's routes. Signed-out visitors pass through to the app's own sign-in. */
export function AppToegangRoute({ app }: { app: BeperkteApp }) {
  const { user, loading } = useAuth();
  const apps = useMijnApps();
  if (loading || (user && !apps)) return <Wachten />;
  if (user && apps && !apps.has(app)) {
    return (
      <Gesloten
        titel="You don't have access to this app"
        tekst="Your Korda account works in KordaBudget, KordaTracker and KordaTrading. Ask the Korda admin if you need this one."
      />
    );
  }
  return <Outlet />;
}

/** /admin: signed in and admin, or nothing. */
export function AdminRoute() {
  const { user, loading } = useAuth();
  const admin = useIsAdmin();
  if (loading || (user && admin === undefined)) return <Wachten />;
  if (!user) return <Gesloten titel="Sign in first" tekst="Sign in with your Korda account, then come back to /admin." />;
  if (!admin) return <Gesloten titel="Admins only" tekst="This account can't manage Korda accounts." />;
  return <Outlet />;
}
