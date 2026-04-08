const SERVER_PORT_FALLBACK = typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 5174;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function configuredApiOrigin() {
  const raw = String((import.meta as any).env?.VITE_API_ORIGIN ?? "").trim();
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
// In production (single-port), they're identical — no point attempting a fallback.
const SAME_ORIGIN_IS_DIRECT_PORT = (() => {
  try {
    const direct = new URL(directServerUrl("/"));
    const origin = new URL(window.location.href);
    return direct.host === origin.host;
  } catch {
    return false;
  }
})();

/** Try to pull a human-readable message out of a non-OK response body. */
async function apiError(res: Response): Promise<Error> {
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (!contentType.includes("application/json")) {
      const text = (await res.text()).trim();
      if (text) {
        if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
          return new Error("Server returned HTML instead of JSON. Check the API/reverse-proxy route for /api.");
        }
        return new Error(text.slice(0, 200));
      }
      return new Error(`${res.status} ${res.statusText}`);
    }

    const body = await res.json() as unknown;
    const b = body as Record<string, unknown>;
    // Prefer first Zod issue message over generic message.
    const issues = b?.issues as Array<{ path: string; message: string }> | undefined;
    if (Array.isArray(issues) && issues.length > 0) {
      const first = issues[0];
      const label = first.path ? `${first.path}: ${first.message}` : first.message;
      return new Error(label);
    }
    const msg = b?.message ?? b?.error;
    if (msg) return new Error(String(msg));
  } catch {
    // ignore JSON parse errors — fall through to status text
  }
  return new Error(`${res.status} ${res.statusText}`);
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("beholden_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mergeInit(init?: RequestInit): RequestInit {
  const authHeaders = getAuthHeaders();
  return {
    ...init,
    headers: { ...authHeaders, ...(init?.headers ?? {}) },
  };
}

/** Raw fetch helper — no automatic auth header injection. Used by AuthContext for login/me. */
export async function apiRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiPath(path), init);
  if (!res.ok) throw await apiError(res);
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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const merged = mergeInit(init);

  // Non-API paths: just fetch as-is.
  if (!path.startsWith("/api")) {
    const res = await fetch(resolveApiPath(path), merged);
    if (!res.ok) throw await apiError(res);
    return (await res.json()) as T;
  }

  if (API_ORIGIN) {
    const res = await fetch(resolveApiPath(path), merged);
    if (!res.ok) throw await apiError(res);
    return (await res.json()) as T;
  }

  // Prefer same-origin first (works with Vite proxy, reverse proxies, and prod single-port).
  let proxyError: Error | null = null;
  try {
    const res = await fetch(path, merged);

    // Client errors (4xx) are real — don't retry.
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500) throw await apiError(res);

    proxyError = new Error(`proxy ${res.status}`);
  } catch (e) {
    proxyError = e instanceof Error ? e : new Error(String(e));
  }

  // In prod (single port), same-origin IS the server — a 5xx there means the
  // server is actually broken, not that we need to try a different port.
  // Skip the fallback to avoid a duplicate request that will also fail.
  if (SAME_ORIGIN_IS_DIRECT_PORT) {
    throw proxyError;
  }

  // Fallback: direct server port (dev split-port mode only).
  const res2 = await fetch(directServerUrl(path), merged);
  if (!res2.ok) throw await apiError(res2);
  return (await res2.json()) as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
