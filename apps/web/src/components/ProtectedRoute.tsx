import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { refreshAccessToken } from "../lib/api-client";
import { useAuthStore } from "../stores/auth-store";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Only admins may enter (role is re-read from the API on every request). */
  adminOnly?: boolean;
}

/**
 * Guards a route: without an access token a silent refresh is attempted
 * (the refresh cookie keeps the child logged in), otherwise the user is sent
 * to the login screen.
 */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.user?.role);
  const location = useLocation();
  const [checking, setChecking] = useState(!token);

  useEffect(() => {
    let cancelled = false;
    if (token) {
      setChecking(false);
      return () => {
        cancelled = true;
      };
    }
    void refreshAccessToken().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (checking) {
    return (
      <p className="p-6 text-slate-500" data-testid="session-check">
        Checking session…
      </p>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
