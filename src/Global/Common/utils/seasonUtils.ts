import { apiRequest } from "../../../Services/API";

export const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

export const displaySeasonLabel = (shortCode: string) => {
  if (!shortCode || !/^\d{2}-\d{2}$/.test(shortCode)) return shortCode;
  const [a, b] = shortCode.split("-");
  return `20${a}-20${b}`;
};

export const normalizeSeasonParam = (s: string) => {
  if (!s) return "";
  if (/^20\d{2}-20\d{2}$/.test(s)) {
    const [start, end] = s.split("-");
    return `${start.slice(-2)}-${end.slice(-2)}`;
  }
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s, 10);
    return `${String(y - 1).slice(-2)}-${String(y).slice(-2)}`;
  }
  return s;
};

export const formatSeason = normalizeSeasonParam;

export const generateSeasonValues = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentStart = m >= 8 ? y : y - 1;
  const arr: string[] = [];
  for (let i = 0; i < 4; i++) {
    const startYear = currentStart - i;
    arr.push(`${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`);
  }
  return arr;
};

export const generateSeasonOptions = () => {
  const values = generateSeasonValues();
  return values.map((value) => ({
    value,
    label: displaySeasonLabel(value),
  }));
};

export type SeasonRecord = {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  sortOrder: number;
};

/**
 * Admin-managed season list (unlimited, arbitrary - see the "Seasons" admin tab). Falls
 * back to the rolling 4-season window on a failed fetch so a transient API error never
 * leaves a dropdown completely empty.
 */
export async function fetchSeasons(): Promise<SeasonRecord[]> {
  try {
    const data = await apiRequest<SeasonRecord[]>("/api/seasons");
    return Array.isArray(data) && data.length > 0
      ? data
      : generateSeasonValues().map((code) => ({ id: code, code, label: displaySeasonLabel(code), active: false, sortOrder: 0 }));
  } catch {
    return generateSeasonValues().map((code) => ({ id: code, code, label: displaySeasonLabel(code), active: false, sortOrder: 0 }));
  }
}

export async function fetchSeasonCodes(): Promise<string[]> {
  const seasons = await fetchSeasons();
  return seasons.map((s) => s.code);
}

/** The admin-set active season, falling back to the date-computed one if unset/unreachable. */
export async function fetchActiveSeasonCode(): Promise<string> {
  try {
    const data = await apiRequest<{ code?: string }>("/api/seasons/active");
    return data?.code || getSeasonValue();
  } catch {
    return getSeasonValue();
  }
}
