const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      // ignore
    }
    throw new Error(`Request to ${path} failed (${res.status}) ${detail}`);
  }
  return res.json();
}

export function startConversation() {
  return request("/api/chat/start", { method: "POST" });
}

export function sendMessage(sessionId, text) {
  return request("/api/chat/message", {
    method: "POST",
    body: JSON.stringify({ sessionId, text }),
  });
}

export function resetConversation(sessionId) {
  return request("/api/chat/reset", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function fetchHistory(sessionId) {
  return request(`/api/chat/history/${sessionId}`);
}

export function fetchSessions() {
  return request("/api/chat/sessions");
}

export function deleteSession(sessionId) {
  return request(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
}

export function fetchHealth() {
  return request("/api/health");
}
