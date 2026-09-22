import fetch from "node-fetch";

/**
 * Client for the Kaggle-hosted Gradio demo. Gradio's HTTP API shape changed
 * between major versions, and we can't be 100% sure which one the Kaggle
 * notebook is running (or whether it changes on a future retrain), so this
 * tries the modern async call/result pattern first and falls back to the
 * legacy synchronous /run/predict endpoint.
 *
 * Modern (Gradio 4.x/5.x):
 *   POST {base}/gradio_api/call/predict   { data: [...] }  -> { event_id }
 *   GET  {base}/gradio_api/call/predict/{event_id}          -> SSE stream of results
 *
 * Legacy:
 *   POST {base}/run/predict   { data: [...] }  -> { data: [...] }
 */

function getBaseUrl() {
  const base = process.env.GRADIO_BASE_URL;
  if (!base) return null;
  return base.replace(/\/+$/, "");
}

export function isConfigured() {
  return Boolean(getBaseUrl());
}

async function tryLegacyPredict(base, inputs, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/run/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: inputs }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    if (!json || !Array.isArray(json.data)) return { ok: false, status: 502 };
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    clearTimeout(timer);
  }
}

async function tryModernPredict(base, inputs, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const startRes = await fetch(`${base}/gradio_api/call/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: inputs }),
      signal: controller.signal,
    });
    if (!startRes.ok) return { ok: false, status: startRes.status };
    const startJson = await startRes.json();
    const eventId = startJson.event_id;
    if (!eventId) return { ok: false, status: 502 };

    const resultRes = await fetch(`${base}/gradio_api/call/predict/${eventId}`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!resultRes.ok) return { ok: false, status: resultRes.status };

    const raw = await resultRes.text();
    // SSE stream: lines like "event: complete" / "data: [...]"
    const dataLine = raw
      .split("\n")
      .reverse()
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return { ok: false, status: 502 };

    const data = JSON.parse(dataLine.replace(/^data:\s*/, ""));
    if (!Array.isArray(data)) return { ok: false, status: 502 };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * inputs must match the order the Gradio demo function expects:
 * [age, gender, disease, symptoms, history]
 */
export async function predict(inputs, { timeoutMs = 60000 } = {}) {
  const base = getBaseUrl();
  if (!base) {
    return { ok: false, reason: "not_configured" };
  }

  const modern = await tryModernPredict(base, inputs, timeoutMs);
  if (modern.ok) return { ok: true, data: modern.data, style: "modern" };

  const legacy = await tryLegacyPredict(base, inputs, timeoutMs);
  if (legacy.ok) return { ok: true, data: legacy.data, style: "legacy" };

  return {
    ok: false,
    reason: "gradio_unreachable",
    modernError: modern,
    legacyError: legacy,
  };
}

export async function checkHealth({ timeoutMs = 8000 } = {}) {
  const base = getBaseUrl();
  if (!base) return { ok: false, reason: "not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/config`, { signal: controller.signal });
    if (res.ok) return { ok: true, base };
    // Some Gradio versions expose config under /gradio_api/config instead
    const res2 = await fetch(`${base}/gradio_api/config`, { signal: controller.signal });
    if (res2.ok) return { ok: true, base };
    return { ok: false, reason: "unreachable", status: res.status };
  } catch (err) {
    return { ok: false, reason: "unreachable", error: err.message };
  } finally {
    clearTimeout(timer);
  }
}
