import config from "../config.js";

function buildUrl(path, params) {
  const base = config.api.baseUrl || "";
  const url = new URL(base + path, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function request(method, path, body, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.api.timeout);
  try {
    const response = await fetch(buildUrl(path, params), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw { status: response.status, message: data?.detail || data?.message || response.statusText };
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const get = (path, params) => request("GET", path, null, params);
export const post = (path, body) => request("POST", path, body);
export const patch = (path, body) => request("PATCH", path, body);
