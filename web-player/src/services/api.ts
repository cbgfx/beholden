const SERVER_PORT_FALLBACK = typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 5174;

declare const __SERVER_PORT__: number;

function directServerUrl(path: string) {
  const loc = window.location;
  return `${loc.protocol}//${loc.hostname}:${SERVER_PORT_FALLBACK}${path}`;
}

const SAME_ORIGIN_IS_DIRECT_PORT = (() => {
  try {
    const direct = new URL(directServerUrl("/"));
    const origin = new URL(window.location.href);
    return direct.host === origin.host;
  } catch {
    return false;
  }
})();

async function apiError(res: Response): Promise<Error> {
  try {
    const body = await res.json() as unknown;
    const b = body as Record<string, unknown>;
    const issues = b?.issues as Array<{ path: string; message: string }> | undefined;
    if (Array.isArray(issues) && issues.length > 0) {
      const first = issues[0];
      const label = first.path ? `${first.path}: ${first.message}` : first.message;
      return new Error(label);
    }
    const msg = b?.message ?? b?.error;
    if (msg) return new Error(String(msg));
  } catch {
    // ignore JSON parse errors
  }
  return new Error(`${res.status} ${res.statusText}`);
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

export async function apiRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const merged = mergeInit(init);

  if (!path.startsWith("/api")) {
    const res = await fetch(path, merged);
    if (!res.ok) throw await apiError(res);
    return (await res.json()) as T;
  }

  let proxyError: Error | null = null;
  try {
    const res = await fetch(path, merged);
    if (res.ok) return (await res.json()) as T;
    if (res.status < 500) throw await apiError(res);
    proxyError = new Error(`proxy ${res.status}`);
  } catch (e) {
    proxyError = e instanceof Error ? e : new Error(String(e));
  }

  if (SAME_ORIGIN_IS_DIRECT_PORT) throw proxyError;

  const res2 = await fetch(directServerUrl(path), merged);
  if (!res2.ok) throw await apiError(res2);
  return (await res2.json()) as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
