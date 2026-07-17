import { useAuthStore } from "../store/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Thin fetch wrapper that attaches the Supabase JWT to every request.
 * DO NOT set Content-Type here for multipart/form-data — the browser must
 * set it automatically so it includes the correct boundary parameter.
 * For JSON requests the header is set explicitly below.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await timedFetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Per-call headers come last so callers can override Content-Type
      // (e.g. file upload strips it entirely via apiFile below)
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body || res.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? message;
    } catch {
      // Non-JSON error body — use raw text
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * File upload variant — sends multipart/form-data.
 * Does NOT set Content-Type so the browser can supply the boundary.
 */
export async function apiFile<T>(path: string, formData: FormData): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await timedFetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    headers: {
      // No Content-Type — browser sets it with the correct multipart boundary
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body || res.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? message;
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function timedFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new ApiError(0, "The WebAssess server is taking too long to respond. Please try again.");
    }
    throw new ApiError(0, "Cannot reach the WebAssess server. Check that the backend is running.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export const get  = <T>(path: string) => api<T>(path, { method: "GET" });
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const del  = <T>(path: string) => api<T>(path, { method: "DELETE" });
