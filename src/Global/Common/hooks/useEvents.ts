import { apiRequest } from "../../../Services/API";
import type {
  ApiEvent,
  ApiEventField,
  ApiEventRegistration,
  ApiEventTeamCheck,
} from "../../../types/api";

type EventPayload = {
  name?: string;
  slug?: string;
  address?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  image?: string;
  fields?: ApiEventField[];
  price?: number | null;
  teamSize?: number;
  published?: boolean;
};

type RawEventResponse = Omit<ApiEvent, "fields"> & { fields: string };

function parseFields(raw: RawEventResponse): ApiEvent {
  let fields: ApiEventField[] = [];
  try {
    fields = typeof raw.fields === "string" ? JSON.parse(raw.fields) : raw.fields;
  } catch {
    fields = [];
  }
  return { ...raw, fields };
}

export async function fetchEvents(): Promise<ApiEvent[]> {
  const data = await apiRequest<RawEventResponse[]>("/api/events");
  return data.map(parseFields);
}

export async function fetchAdminEvents(): Promise<ApiEvent[]> {
  const data = await apiRequest<RawEventResponse[]>("/api/events/admin");
  return data.map(parseFields);
}

export async function fetchEventBySlug(slug: string): Promise<ApiEvent> {
  const data = await apiRequest<RawEventResponse>(`/api/events/slug/${slug}`);
  return parseFields(data);
}

export async function createEvent(payload: EventPayload): Promise<ApiEvent> {
  const body = {
    ...payload,
    fields: payload.fields ? JSON.stringify(payload.fields) : "[]",
  };
  const data = await apiRequest<RawEventResponse>("/api/events", {
    method: "POST",
    json: body,
  });
  return parseFields(data);
}

export async function updateEvent(id: string, payload: EventPayload): Promise<ApiEvent> {
  const body = {
    ...payload,
    fields: payload.fields ? JSON.stringify(payload.fields) : undefined,
  };
  const data = await apiRequest<RawEventResponse>(`/api/events/${id}`, {
    method: "PUT",
    json: body,
  });
  return parseFields(data);
}

export async function deleteEvent(id: string): Promise<void> {
  await apiRequest(`/api/events/${id}`, { method: "DELETE" });
}

export async function fetchRegistrations(eventId: string): Promise<ApiEventRegistration[]> {
  return apiRequest<ApiEventRegistration[]>(`/api/events/${eventId}/registrations`);
}

export async function checkTeammate(
  eventId: string,
  email: string
): Promise<ApiEventTeamCheck> {
  return apiRequest<ApiEventTeamCheck>(
    `/api/events/${eventId}/team-check?email=${encodeURIComponent(email)}`
  );
}

export async function registerForEvent(
  eventId: string,
  payload: {
    paypalOrderId?: string;
    payerName: string;
    payerEmail: string;
    formData: Record<string, unknown>;
    teammateEmails?: string[];
    teamId?: string;
  }
): Promise<ApiEventRegistration> {
  return apiRequest<ApiEventRegistration>(`/api/events/${eventId}/register`, {
    method: "POST",
    json: {
      ...payload,
      formData: JSON.stringify(payload.formData),
    },
  });
}
