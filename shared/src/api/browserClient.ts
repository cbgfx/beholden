type MetaEnv = ImportMeta & { env?: Record<string, unknown> };

const maybeServerPort = (globalThis as { __SERVER_PORT__?: unknown }).__SERVER_PORT__;
const SERVER_PORT_FALLBACK = typeof maybeServerPort === "number" ? maybeServerPort : 5174;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function configuredApiOrigin() {
  const raw = String((import.meta as MetaEnv).env?.VITE_API_ORIGIN ?? "").trim();
  if (!raw) return "";
  try {
    return trimTrailingSlash(new URL(raw).toString());
  } catch {
    return trimTrailingSlash(raw);
  }
}

const API_ORIGIN = configuredApiOrigin();

function resolveApiPath(path: string) {
  if (!API_ORIGIN || !path.startsWith("/")) return path;
  return `${API_ORIGIN}${path}`;
}

export function resolveAssetUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^(?:https?:)?\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (/^(?:data|blob):/i.test(pathOrUrl)) return pathOrUrl;
  if (API_ORIGIN && pathOrUrl.startsWith("/")) return `${API_ORIGIN}${pathOrUrl}`;
  return pathOrUrl;
}

function directServerUrl(path: string) {
  const loc = window.location;
  return `${loc.protocol}//${loc.hostname}:${SERVER_PORT_FALLBACK}${path}`;
}

// Resolve once at module load whether same-origin and direct-port are actually different.
// In production (single-port), they are identical so fallback retries are unnecessary.
const SAME_ORIGIN_IS_DIRECT_PORT = (() => {
  try {
    const direct = new URL(directServerUrl("/"));
    const origin = new URL(window.location.href);
    return direct.host === origin.host;
  } catch {
    return false;
  }
})();

/** An `Error` from a non-OK API response, carrying the HTTP status and any `code` from the body. */
export interface ApiError extends Error {
  status?: number;
  code?: string;
}

/** Try to pull a human-readable message out of a non-OK response body. */
async function apiError(res: Response): Promise<ApiError> {
  const contentType = res.headers.get("content-type") ?? "";
  const retryAfter = Number(res.headers.get("retry-after"));
  const retryText = Number.isFinite(retryAfter) && retryAfter > 0
    ? ` Please wait ${Math.ceil(retryAfter)} seconds and try again.`
    : "";

  // Every path stamps the HTTP status (and a body `code`, when present) onto the
  // returned Error so callers can branch on e.g. a 409 conflict.
  let code: string | undefined;
  const finish = (error: Error): ApiError =>
    Object.assign(error, { status: res.status, ...(code ? { code } : {}) });

  try {
    if (!contentType.includes("application/json")) {
      const text = (await res.text()).trim();
      if (text) {
        if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
          return finish(new Error("Server returned HTML instead of JSON. Check the API/reverse-proxy route for /api."));
        }
        return finish(new Error(text.slice(0, 200)));
      }
      return finish(new Error(`${res.status} ${res.statusText}`));
    }

    const body = (await res.json()) as unknown;
    const b = body as Record<string, unknown>;
    if (typeof b.code === "string") code = b.code;
    const issues = b.issues as Array<{ path: string; message: string }> | undefined;
    if (Array.isArray(issues) && issues.length > 0) {
      const first = issues[0];
      const label = first.path ? `${first.path}: ${first.message}` : first.message;
      return finish(new Error(label));
    }
    if (b.error === "rate_limited") {
      return finish(new Error(`Too many requests.${retryText}`));
    }
    const msg = b.message ?? b.error;
    if (msg) return finish(new Error(String(msg)));
  } catch {
    // Ignore JSON parse errors and fall through to status text.
  }
  if (res.status === 429) return finish(new Error(`Too many requests.${retryText}`));
  return finish(new Error(`${res.status} ${res.statusText}`));
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("beholden_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mergeInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers ?? {}) },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Raw fetch helper without auth header injection. Used by AuthContext for login/me. */
export async function apiRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiPath(path), init);
  if (!res.ok) {
    const error = await apiError(res);
    Object.assign(error, { status: res.status });
    throw error;
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = (await res.text()).trim();
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      throw new Error("Server returned HTML instead of JSON. Check the API/reverse-proxy route for /api.");
    }
    throw new Error(text || "Server returned a non-JSON response.");
  }
  return (await res.json()) as T;
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const merged = mergeInit(init);
  const safeRead = ["GET", "HEAD"].includes((init?.method ?? "GET").toUpperCase());
  const fallback = path.startsWith("/api") && !API_ORIGIN && !SAME_ORIGIN_IS_DIRECT_PORT && safeRead;
  let response: Response;
  try {
    response = await fetch(resolveApiPath(path), merged);
  } catch (error) {
    if (!fallback || isAbortError(error)) throw error;
    response = await fetch(directServerUrl(path), merged);
    if (!response.ok) throw await apiError(response);
    return response;
  }
  if (response.status >= 500 && fallback) response = await fetch(directServerUrl(path), merged);
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await fetchApi(path, init)).json()) as T;
}

const inFlightReads = new Map<string, Promise<unknown>>();

/** Shares identical authenticated GETs while they are in flight. Mutations and abortable reads stay independent. */
export function apiCoalesced<T>(path: string): Promise<T> {
  const existing = inFlightReads.get(path) as Promise<T> | undefined;
  if (existing) return existing;
  const request = api<T>(path).finally(() => {
    if (inFlightReads.get(path) === request) inFlightReads.delete(path);
  });
  inFlightReads.set(path, request);
  return request;
}

/** Authenticated binary download using the same safe-read transport policy. */
export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  return (await fetchApi(path, init)).blob();
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
