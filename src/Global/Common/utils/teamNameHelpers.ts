import type { ApiEventRegistration } from "../../../types/api";

const NUMBER_WORD_MAP: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
};

const NUMBER_WORD_REGEX = new RegExp(
  `\\b(${Object.keys(NUMBER_WORD_MAP).join("|")})\\b`,
  "gi"
);

function replaceNumberWords(value: string): string {
  return value.replace(NUMBER_WORD_REGEX, (match) => {
    const lower = match.toLowerCase();
    return NUMBER_WORD_MAP[lower] ?? match;
  });
}

function sanitizeForMatching(value: string): string {
  const normalized = replaceNumberWords(value.toLowerCase());
  return normalized.replace(/[^a-z0-9]/g, "");
}

export function normalizeTeamNameValue(value: unknown): string | null {
  if (value == null) return null;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  if (!trimmed) return null;
  const sanitized = sanitizeForMatching(trimmed);
  return sanitized || null;
}

export function parseRegistrationFormData(
  reg: ApiEventRegistration
): Record<string, unknown> {
  const raw = reg.formData;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return (raw as Record<string, unknown>) ?? {};
}

export function getRegistrationTeamName(
  reg: ApiEventRegistration,
  fieldId: string | null
): string | null {
  if (!fieldId) return null;
  const data = parseRegistrationFormData(reg);
  return normalizeTeamNameValue(data[fieldId]);
}

export function getRegistrationTeamLabel(
  reg: ApiEventRegistration,
  fieldId: string | null
): string | null {
  if (!fieldId) return null;
  const data = parseRegistrationFormData(reg);
  const value = data[fieldId];
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function extractTeamNameLabel(
  members: ApiEventRegistration[],
  fieldId: string | null
): string | null {
  if (!fieldId) return null;
  for (const member of members) {
    const label = getRegistrationTeamLabel(member, fieldId);
    if (label) return label;
  }
  return null;
}
