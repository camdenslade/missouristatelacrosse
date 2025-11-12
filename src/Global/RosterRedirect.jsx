// src/Global/ScheduleRedirect.jsx
import { Navigate } from "react-router-dom";
import { getCurrentYear } from "../../../../Services/yearHelper.js";

export default function ScheduleRedirect() {
  const currentSeason = getCurrentYear();
  return <Navigate to={`/schedule/${currentSeason}`} replace />;
}

