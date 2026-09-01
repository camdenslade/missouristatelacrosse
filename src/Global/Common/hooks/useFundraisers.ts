import { apiRequest } from "../../../Services/API";
import type { ApiFundraiser, ApiFundraiserExpense } from "../../../types/api";

// The backend stores/returns `expenses` as a JSON string (jsonb column) - these helpers
// translate that boundary so the rest of the app can just work with ApiFundraiserExpense[].
type RawFundraiser = Omit<ApiFundraiser, "expenses"> & { expenses?: string | null };

function parseExpenses(raw?: string | null): ApiFundraiserExpense[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fromRaw(raw: RawFundraiser): ApiFundraiser {
  return { ...raw, expenses: parseExpenses(raw.expenses) };
}

export type FundraiserPayload = {
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  goalAmount?: number | null;
  expenses?: ApiFundraiserExpense[];
  active?: boolean;
  published?: boolean;
};

function toRawPayload(payload: FundraiserPayload) {
  return {
    ...payload,
    expenses: payload.expenses !== undefined ? JSON.stringify(payload.expenses) : undefined,
  };
}

export async function fetchFundraisers(): Promise<ApiFundraiser[]> {
  const raw = await apiRequest<RawFundraiser[]>("/api/fundraisers");
  return raw.map(fromRaw);
}

export async function fetchAdminFundraisers(): Promise<ApiFundraiser[]> {
  const raw = await apiRequest<RawFundraiser[]>("/api/fundraisers/admin");
  return raw.map(fromRaw);
}

export async function fetchFundraiserBySlug(slug: string): Promise<ApiFundraiser> {
  const raw = await apiRequest<RawFundraiser>(`/api/fundraisers/slug/${slug}`);
  return fromRaw(raw);
}

export async function createFundraiser(payload: FundraiserPayload): Promise<ApiFundraiser> {
  const raw = await apiRequest<RawFundraiser>("/api/fundraisers", {
    method: "POST",
    json: toRawPayload(payload),
  });
  return fromRaw(raw);
}

export async function updateFundraiser(id: string, payload: FundraiserPayload): Promise<ApiFundraiser> {
  const raw = await apiRequest<RawFundraiser>(`/api/fundraisers/${id}`, {
    method: "PUT",
    json: toRawPayload(payload),
  });
  return fromRaw(raw);
}

export async function deleteFundraiser(id: string): Promise<void> {
  await apiRequest(`/api/fundraisers/${id}`, { method: "DELETE" });
}
