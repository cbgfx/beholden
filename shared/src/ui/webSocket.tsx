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
import { createWebSocketConnection } from "./webSocketConnection";

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
  setScope: (scope: { campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }) => void;
  connected: boolean;
};

const WsContext = createContext<WsCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider — mounts exactly one WebSocket for the lifetime of the app
// ---------------------------------------------------------------------------

function withToken(url: string): string {
  const token = localStorage.getItem("beholden_token") ?? "";
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

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

    const dispatch = (msg: WsMessage) => {
      // The live database was just wholesale-replaced by an admin import — every
      // in-memory store is stale in ways too broad to patch. Reload instead of dispatching.
      if (msg.type === "database:imported") {
        window.location.reload();
        return;
      }
      for (const h of subscribers.current) h(msg);
    };

    return createWebSocketConnection({
      url: () => withToken(WS_ORIGIN ? wsUrlConfigured() : wsUrlSameOrigin()),
      fallbackUrl: !WS_ORIGIN && canUseDirectPortFallback()
        ? () => withToken(wsUrlDirect())
        : undefined,
      onSocket: (socket) => {
        socketRef.current = socket;
        if (!socket) setConnected(false);
      },
      onOpen: (socket) => {
        setConnected(true);
        try {
          socket.send(JSON.stringify({ type: "ws:scope", payload: scopeRef.current }));
        } catch { /* Transport closed while opening. */ }
      },
      onMessage: (event) => {
        try { dispatch(JSON.parse(event.data) as WsMessage); }
        catch { /* Ignore malformed frames. */ }
      },
    });
  }, []);

  const ctx = React.useMemo(() => ({ subscribe, setScope, connected }), [subscribe, setScope, connected]);

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

  const { subscribe } = ctx;
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const forwarder: Handler = (msg) => handlerRef.current(msg);
    return subscribe(forwarder);
  }, [subscribe]);
}

export function useWsScope(scope: { campaignId?: string | null; adventureId?: string | null; encounterId?: string | null }) {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("<WsProvider> is missing from the tree.");
  const { campaignId, adventureId, encounterId } = scope;
  const { setScope } = ctx;

  useEffect(() => {
    setScope({ campaignId, adventureId, encounterId });
  }, [setScope, campaignId, adventureId, encounterId]);
}
