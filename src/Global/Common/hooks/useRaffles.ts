import { apiRequest } from "../../../Services/API";
import type { ApiRaffle, ApiRaffleEntry } from "../../../types/api";

type RafflePayload = {
  name?: string;
  description?: string;
  image?: string;
  images?: string[];
  ticketPrice?: number | null;
  maxTicketsPerPerson?: number | null;
  allowBids?: boolean;
  published?: boolean;
  status?: string;
  endTime?: string;
  clearEndTime?: boolean;
  winnerName?: string;
  winnerEmail?: string;
};

export async function fetchRaffles(): Promise<ApiRaffle[]> {
  return apiRequest<ApiRaffle[]>("/api/raffles");
}

export async function fetchAdminRaffles(): Promise<ApiRaffle[]> {
  return apiRequest<ApiRaffle[]>("/api/raffles/admin");
}

export async function fetchRaffleBySlug(slug: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/slug/${slug}`);
}

export async function createRaffle(payload: RafflePayload): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>("/api/raffles", { method: "POST", json: payload });
}

export async function updateRaffle(id: string, payload: RafflePayload): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}`, { method: "PUT", json: payload });
}

export async function deleteRaffle(id: string): Promise<void> {
  await apiRequest(`/api/raffles/${id}`, { method: "DELETE" });
}

export async function fetchRaffleEntries(id: string): Promise<ApiRaffleEntry[]> {
  return apiRequest<ApiRaffleEntry[]>(`/api/raffles/${id}/entries`);
}

export async function drawRaffleWinner(id: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}/draw`, { method: "POST" });
}

export async function closeRaffle(id: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}/close`, { method: "POST" });
}

export async function reopenRaffle(id: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}/reopen`, { method: "POST" });
}

export async function addAdminEntry(
  raffleId: string,
  payload: {
    payerName: string;
    payerEmail?: string;
    payerPhone?: string;
    ticketCount?: number;
    bidAmount?: number;
  }
): Promise<ApiRaffleEntry> {
  return apiRequest<ApiRaffleEntry>(`/api/raffles/${raffleId}/admin-entry`, {
    method: "POST",
    json: payload,
  });
}

export async function setupRaffleStream(id: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}/stream/setup`, { method: "POST" });
}

export async function toggleRaffleStream(id: string): Promise<ApiRaffle> {
  return apiRequest<ApiRaffle>(`/api/raffles/${id}/stream/go-live`, { method: "POST" });
}

export async function enterRaffle(
  id: string,
  payload: {
    payerName: string;
    payerEmail: string;
    payerPhone?: string;
    paypalOrderId?: string;
    ticketCount?: number;
    bidAmount?: number;
  }
): Promise<ApiRaffleEntry> {
  return apiRequest<ApiRaffleEntry>(`/api/raffles/${id}/enter`, {
    method: "POST",
    json: payload,
  });
}
