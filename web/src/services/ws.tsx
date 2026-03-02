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
// Internal singleton connection (module-level, not React state)
// ---------------------------------------------------------------------------

function wsUrlSameOrigin() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function wsUrl5174() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.hostname}:5174/ws`;
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

  // Stable subscribe function — never changes identity.
  const subscribe = React.useCallback((handler: Handler) => {
    subscribers.current.add(handler);
    return () => { subscribers.current.delete(handler); };
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;

    const dispatch = (msg: WsMessage) => {
      for (const h of subscribers.current) h(msg);
    };

    const connect = (url: string, fallback?: () => void) => {
      if (dead) return;
      ws = new WebSocket(url);
      let settled = false;

      const failTimer = window.setTimeout(() => {
        if (!settled) {
          try { ws?.close(); } catch {}
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
          try { ws?.close(); } catch {}
          fallback?.();
        }
      };

      ws.onclose = () => {
        window.clearTimeout(failTimer);
        setConnected(false);
        // Reconnect after a short backoff unless the provider is unmounting.
        if (!dead) {
          window.setTimeout(() => {
            if (!dead) connect(url, fallback);
          }, 3000);
        }
      };
    };

    const isLocalhost =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";

    if (isLocalhost) {
      connect(wsUrlSameOrigin(), () => connect(wsUrl5174()));
    } else {
      connect(wsUrl5174(), () => connect(wsUrlSameOrigin()));
    }

    return () => {
      dead = true;
      try { ws?.close(); } catch {}
    };
  }, []); // runs once — no dependencies

  const ctx = React.useMemo(() => ({ subscribe, connected }), [subscribe, connected]);

  return <WsContext.Provider value={ctx}>{children}</WsContext.Provider>;
}

// ---------------------------------------------------------------------------
// useWs — subscribe to messages. Handler identity doesn't matter.
// ---------------------------------------------------------------------------

export function useWsStatus(): boolean {
  const ctx = useContext(WsContext);
  return ctx?.connected ?? false;
}

export function useWs(onMessage: Handler) {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("<WsProvider> is missing from the tree.");

  // Always keep the ref current so stale closures are never an issue.
  const handlerRef = useRef(onMessage);
  useEffect(() => { handlerRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    // Wrap in a stable forwarder so subscribe/unsubscribe is stable.
    const forwarder: Handler = (msg) => handlerRef.current(msg);
    return ctx.subscribe(forwarder);
  }, [ctx]); // ctx is stable — this runs once per mount
}
