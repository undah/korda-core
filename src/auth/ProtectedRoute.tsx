import { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  // <Navigate>'s effect depends on `state` by reference, so a fresh object
  // literal here would re-fire navigate() on every render and never settle.
  const redirectState = useMemo(() => ({ from: location.pathname }), [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={redirectState} />;
  }

  return <Outlet />;
}
