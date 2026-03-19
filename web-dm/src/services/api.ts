const SERVER_PORT_FALLBACK = typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 5174;

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
  try {
    const body = await res.json() as unknown;
    const msg = (body as Record<string, unknown>)?.message ?? (body as Record<string, unknown>)?.error;
    if (msg) return new Error(String(msg));
  } catch {
    // ignore JSON parse errors — fall through to status text
  }
  return new Error(`${res.status} ${res.statusText}`);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Non-API paths: just fetch as-is.
  if (!path.startsWith("/api")) {
    const res = await fetch(path, init);
    if (!res.ok) throw await apiError(res);
    return (await res.json()) as T;
  }

  // Prefer same-origin first (works with Vite proxy, reverse proxies, and prod single-port).
  let proxyError: Error | null = null;
  try {
    const res = await fetch(path, init);

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
  const res2 = await fetch(directServerUrl(path), init);
  if (!res2.ok) throw await apiError(res2);
  return (await res2.json()) as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
