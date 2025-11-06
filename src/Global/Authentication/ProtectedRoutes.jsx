// src/Global/Authentication/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../Context/AuthContext.jsx";

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const location = useLocation();
  const { user, roles, loading } = useAuth();

  const isWomen = location.pathname.toLowerCase().startsWith("/women");
  const homePath = isWomen ? "/women" : "/";
  const activeRole = isWomen ? roles?.women : roles?.men;

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) return <Navigate to={homePath} replace />;

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
