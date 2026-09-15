import { Navigate } from "react-router-dom";

import { useAuth } from "../../../../Global/Context/AuthContext";

export default function PaymentsRedirect() {
  const { roles, loading } = useAuth();

  if (loading) return <p className="text-gray-600 animate-pulse px-4 py-8">Loading...</p>;

  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program = isWomenSite ? "women" : "men";
  const base = isWomenSite ? "/women" : "";

  return <Navigate to={roles?.[program] === "admin" ? `${base}/manage` : `${base}/portal`} replace />;
}
