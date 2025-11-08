const API_BASE = import.meta.env.VITE_API_BASE;

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.replace(/^\/+/, '')}`;
  
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  const res = await fetch(url, config);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
  
}
export default API_BASE;
