/**
 * ws.ts — Singleton WebSocket layer.
 *
 * One socket for the entire app. All callers subscribe via `useWs(handler)`.
 * Handlers are stored in a ref-based subscriber set — no reconnects on render.
 *
 * Usage:
 *   Wrap your root with <WsProvider>.
 *   Call useWs((msg) => { ... }) anywhere in the tree.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WsMessage = { type: string; payload?: unknown };
type Handler = (msg: WsMessage) => void;

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function wsProto() {
  return location.protocol === "https:" ? "wss" : "ws";
}

function configuredWsOrigin() {
  const rawWs = String((import.meta as any).env?.VITE_WS_ORIGIN ?? "").trim();
  const rawApi = String((import.meta as any).env?.VITE_API_ORIGIN ?? "").trim();
  const raw = rawWs || rawApi;
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(raw)
      .replace(/^https:\/\//i, "wss://")
      .replace(/^http:\/\//i, "ws://");
  }
}

const WS_ORIGIN = configuredWsOrigin();

function wsUrlSameOrigin() {
  return `${wsProto()}://${location.host}/ws`;
}

function wsUrlConfigured() {
  return WS_ORIGIN ? `${WS_ORIGIN}/ws` : "";
}

declare const __SERVER_PORT__: number;

function wsUrlDirect() {
  const port = typeof __SERVER_PORT__ !== "undefined" ? __SERVER_PORT__ : 5174;
  return `${wsProto()}://${location.hostname}:${port}/ws`;
}

function isLocalDevHostname(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const m = hostname.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }

  return false;
}

function canUseDirectPortFallback() {
  return isLocalDevHostname(location.hostname);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type WsCtx = {
  subscribe: (handler: Handler) => () => void;
  connected: boolean;
};

const WsContext = createContext<WsCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider — mounts exactly one WebSocket for the lifetime of the app
// ---------------------------------------------------------------------------

export function WsProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Set<Handler>>(new Set());
  const [connected, setConnected] = React.useState(false);

  const subscribe = React.useCallback((handler: Handler) => {
    subscribers.current.add(handler);
    return () => {
      subscribers.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;
    let usingDirectFallback = false;

    const dispatch = (msg: WsMessage) => {
      for (const h of subscribers.current) h(msg);
    };

    const connect = (url: string, fallback?: () => void) => {
      if (dead) return;

      ws = new WebSocket(url);
      let settled = false;

      const failTimer = window.setTimeout(() => {
        if (!settled) {
          try {
            ws?.close();
          } catch {}
          fallback?.();
        }
      }, 800);

      ws.onopen = () => {
        settled = true;
        window.clearTimeout(failTimer);
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          dispatch(JSON.parse(ev.data) as WsMessage);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        if (!settled) {
          window.clearTimeout(failTimer);
          try {
            ws?.close();
          } catch {}
          fallback?.();
        }
      };

      ws.onclose = () => {
        window.clearTimeout(failTimer);
        setConnected(false);

        if (dead) return;

        window.setTimeout(() => {
          if (dead) return;

          // If a configured WS origin is set, always reconnect to it.
          if (WS_ORIGIN) {
            connect(wsUrlConfigured());
            return;
          }

          // In local split-port dev, keep reconnecting to whichever mode succeeded.
          if (usingDirectFallback) {
            connect(wsUrlDirect());
            return;
          }

          // Everywhere else, stay on same-origin only.
          connect(
            wsUrlSameOrigin(),
            canUseDirectPortFallback()
              ? () => {
                  usingDirectFallback = true;
                  connect(wsUrlDirect());
                }
              : undefined
          );
        }, 3000);
      };
    };

    if (WS_ORIGIN) {
      connect(wsUrlConfigured());
      return () => {
        dead = true;
        try {
          ws?.close();
        } catch {}
      };
    }

    connect(
      wsUrlSameOrigin(),
      canUseDirectPortFallback()
        ? () => {
            usingDirectFallback = true;
            connect(wsUrlDirect());
          }
        : undefined
    );

    return () => {
      dead = true;
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  const ctx = React.useMemo(() => ({ subscribe, connected }), [subscribe, connected]);

  return <WsContext.Provider value={ctx}>{children}</WsContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useWsStatus(): boolean {
  const ctx = useContext(WsContext);
  return ctx?.connected ?? false;
}

export function useWs(onMessage: Handler) {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("<WsProvider> is missing from the tree.");

  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const forwarder: Handler = (msg) => handlerRef.current(msg);
    return ctx.subscribe(forwarder);
  }, [ctx]);
}
