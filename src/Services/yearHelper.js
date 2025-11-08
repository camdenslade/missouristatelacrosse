// src/Services/yearHelper.js
export function getCurrentYear() {
  const cached = localStorage.getItem("currentYear");
  if (cached) return cached;

  const now = new Date().getFullYear().toString();
  localStorage.setItem("currentYear", now);
  return now;
}

export function setCurrentYear(year) {
  if (!year) return;
  localStorage.setItem("currentYear", year.toString());
}

export function clearCurrentYear() {
  localStorage.removeItem("currentYear");
}
