import { useRef } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { rememberPostLoginRedirect } from "./postLoginRedirect";
import { useAuth } from "../Context/AuthContext";

type ProtectedRouteProps = {
  allowedRoles?: string[];
  children: ReactNode;
};

export default function ProtectedRoute({ allowedRoles = [], children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, roles, loading } = useAuth();
  // Set once someone is signed in on this page, so signing out here just goes home instead
  // of prompting them to sign back in.
  const hadUser = useRef(false);
  if (user) hadUser.current = true;

  const isWomen = location.pathname.toLowerCase().startsWith("/women");
  const homePath = isWomen ? "/women" : "/";
  const activeRole = isWomen ? roles?.women : roles?.men;

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) {
    if (hadUser.current) return <Navigate to={homePath} replace />;
    rememberPostLoginRedirect(location.pathname + location.search);
    return <Navigate to={homePath} replace state={{ signIn: true }} />;
  }

  if (!activeRole){
    return location.pathname === "/pending-approval"
      ? children
      : <Navigate to="/pending-approval" replace />;
  }

  if (location.pathname === "/pending-approval"){
    return <Navigate to={homePath} replace />;
  }

  const normalized = typeof activeRole === "string"
    ? activeRole.trim().toLowerCase()
    : "";
  const allowed = allowedRoles.map((r) => r.trim().toLowerCase());
  const isAllowed = normalized === "superadmin" || allowed.includes(normalized);

  if (!isAllowed) return <Navigate to={homePath} replace />;

  return children;
}

