import { apiRequest } from "../../../../../Services/API";
import type { ApiPaymentCard, ApiPaymentCardCompletion, ApiPaymentCardStatus } from "../../../../../types/api";

export type PaymentCardPayload = {
  season?: string;
  title?: string;
  description?: string;
  link?: string;
  amount?: number | null;
  active?: boolean;
};

export async function fetchPaymentCards(season: string): Promise<ApiPaymentCard[]> {
  return apiRequest<ApiPaymentCard[]>(`/api/payment-cards?season=${encodeURIComponent(season)}`);
}

export async function createPaymentCard(payload: PaymentCardPayload): Promise<ApiPaymentCard> {
  return apiRequest<ApiPaymentCard>("/api/payment-cards", { method: "POST", json: payload });
}

export async function updatePaymentCard(id: string, payload: PaymentCardPayload): Promise<ApiPaymentCard> {
  return apiRequest<ApiPaymentCard>(`/api/payment-cards/${id}`, { method: "PUT", json: payload });
}

export async function deletePaymentCard(id: string): Promise<void> {
  await apiRequest(`/api/payment-cards/${id}`, { method: "DELETE" });
}

export async function fetchPlayerCardStatuses(playerId: string): Promise<ApiPaymentCardStatus[]> {
  return apiRequest<ApiPaymentCardStatus[]>(`/api/payment-cards/status?playerId=${playerId}`);
}

export async function setPlayerCardStatus(cardId: string, playerId: string, done: boolean): Promise<ApiPaymentCardStatus> {
  return apiRequest<ApiPaymentCardStatus>("/api/payment-cards/status", {
    method: "PUT",
    json: { cardId, playerId, done },
  });
}

export async function fetchCardCompletions(cardId: string): Promise<ApiPaymentCardCompletion[]> {
  return apiRequest<ApiPaymentCardCompletion[]>(`/api/payment-cards/${cardId}/completions`);
}
