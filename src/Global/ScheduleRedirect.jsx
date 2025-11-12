// src/Global/RosterRedirect.jsx
import { Navigate } from "react-router-dom";
import { getCurrentYear } from "../../../../Services/yearHelper.js";

export default function RosterRedirect() {
  const currentSeason = getCurrentYear();
  return <Navigate to={`/roster/${currentSeason}`} replace />;
}
