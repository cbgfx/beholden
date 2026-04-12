/**
 * ws.tsx — Singleton WebSocket layer for web-player.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";

export type WsMessage = { type: string; payload?: unknown };
type Handler = (msg: WsMessage) => void;

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

type WsCtx = {
  subscribe: (handler: Handler) => () => void;
  setScope: (scope: { campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }) => void;
  connected: boolean;
};

const WsContext = createContext<WsCtx | null>(null);

export function WsProvider({ children }: { children: React.ReactNode }) {
  const subscribers = useRef<Set<Handler>>(new Set());
  const socketRef = useRef<WebSocket | null>(null);
  const scopeRef = useRef<{ campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }>({});
  const [connected, setConnected] = React.useState(false);

  const subscribe = React.useCallback((handler: Handler) => {
    subscribers.current.add(handler);
    return () => {
      subscribers.current.delete(handler);
    };
  }, []);

  const setScope = React.useCallback((scope: { campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }) => {
    const next = {
      campaignId: scope.campaignId ?? null,
      adventureId: scope.adventureId ?? null,
      encounterId: scope.encounterId ?? null,
    };
    scopeRef.current = next;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "ws:scope", payload: next }));
    } catch {
      // ignore transport race
    }
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
      socketRef.current = ws;
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
        try {
          ws?.send(JSON.stringify({ type: "ws:scope", payload: scopeRef.current }));
        } catch {
          // ignore transport race
        }
      };

      ws.onmessage = (ev) => {
        try {
          dispatch(JSON.parse(ev.data) as WsMessage);
        } catch {}
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
        socketRef.current = null;

        if (dead) return;

        window.setTimeout(() => {
          if (dead) return;

          if (WS_ORIGIN) {
            connect(wsUrlConfigured());
            return;
          }

          if (usingDirectFallback) {
            connect(wsUrlDirect());
            return;
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
      socketRef.current = null;
      try {
        ws?.close();
      } catch {}
    };
  }, []);

  const ctx = React.useMemo(() => ({ subscribe, setScope, connected }), [subscribe, setScope, connected]);
  return <WsContext.Provider value={ctx}>{children}</WsContext.Provider>;
}

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

export function useWsScope(scope: { campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }) {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("<WsProvider> is missing from the tree.");

  useEffect(() => {
    ctx.setScope(scope);
  }, [ctx, scope.campaignId, scope.adventureId, scope.encounterId]);
}
