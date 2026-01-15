import { auth } from "./firebaseConfig";
import { getActiveProgram } from "./programHelper";

const API_BASE = import.meta.env.VITE_API_BASE;

type ApiOptions = RequestInit & {
  json?: unknown;
  parseAs?: "json" | "text";
};

async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function apiRequest<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const base = (API_BASE || "").replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const token = await getAuthToken();
  const program = getActiveProgram();
  let url = `${base}${path}`;

  if (program && !/[?&]program=/.test(url)) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}program=${encodeURIComponent(program)}`;
  }

  const headers = new Headers(options.headers as HeadersInit);
  headers.set("Content-Type", "application/json");
  if (program) {
    headers.set("X-Program", program);
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.json !== undefined) {
    config.body = JSON.stringify(options.json);
  }

  const res = await fetch(url, config);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (options.parseAs === "text") {
    return (await res.text()) as T;
  }

  return (await res.json().catch(() => ({}))) as T;
}

export default API_BASE;
