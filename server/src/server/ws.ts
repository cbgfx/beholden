import type { Server } from "http";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import type { BroadcastFn, ServerEventMap, ServerEventType } from "./events.js";

export function createWsServer(opts: {
  httpServer: Server;
  path?: string;
  onConnectionHello?: (ws: WebSocket) => void;
  authorize?: (req: import('http').IncomingMessage) => boolean;
}) {
  const { httpServer, path = "/ws", onConnectionHello, authorize } = opts;
  const wsCompressionRaw = String(process.env.BEHOLDEN_WS_COMPRESSION ?? "true").trim().toLowerCase();
  const wsCompressionEnabled =
    wsCompressionRaw === "1" || wsCompressionRaw === "true" || wsCompressionRaw === "yes";
  const wss = new WebSocketServer({
    server: httpServer,
    path,
    perMessageDeflate: wsCompressionEnabled
      ? {
          // Avoid compressing tiny frames where compression overhead outweighs gains.
          threshold: 1024,
          clientNoContextTakeover: true,
          serverNoContextTakeover: true,
          concurrencyLimit: 10,
        }
      : false,
  });

  wss.on("connection", (ws, req) => {
    if (authorize && !authorize(req)) {
      try { ws.close(1008, "Unauthorized"); } catch {}
      return;
    }
    // We are server->client only. Ignore inbound client messages.
    ws.on("message", () => {
      /* ignored */
    });

    if (onConnectionHello) onConnectionHello(ws);
  });

  return wss;
}

export function sendWsEvent<K extends ServerEventType>(ws: WebSocket, type: K, payload: ServerEventMap[K]) {
  ws.send(JSON.stringify({ type, payload }));
}

export function createBroadcaster(wss: WebSocketServer | null | undefined): BroadcastFn {
  const refreshCoalesceWindowRaw = Number(process.env.BEHOLDEN_WS_REFRESH_COALESCE_MS ?? 40);
  const refreshCoalesceWindowMs =
    Number.isFinite(refreshCoalesceWindowRaw) && refreshCoalesceWindowRaw > 0
      ? Math.floor(refreshCoalesceWindowRaw)
      : 0;
  const pendingRefresh = new Map<string, string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flushPendingRefresh = () => {
    if (!wss || pendingRefresh.size === 0) {
      flushTimer = null;
      pendingRefresh.clear();
      return;
    }
    const messages = Array.from(pendingRefresh.values());
    pendingRefresh.clear();
    flushTimer = null;
    for (const ws of wss.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      for (const msg of messages) ws.send(msg);
    }
  };

  const queueRefresh = (key: string, msg: string) => {
    pendingRefresh.set(key, msg);
    if (!flushTimer) {
      flushTimer = setTimeout(flushPendingRefresh, refreshCoalesceWindowMs);
    }
  };

  const broadcast = (<K extends ServerEventType>(type: K, payload: ServerEventMap[K]) => {
    if (!wss) return;
    if (refreshCoalesceWindowMs > 0) {
      const refreshKey = getRefreshCoalesceKey(type, payload);
      if (refreshKey) {
        queueRefresh(refreshKey, JSON.stringify({ type, payload }));
        return;
      }
    }
    const msg = JSON.stringify({ type, payload });
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  }) as BroadcastFn;

  return broadcast;
}

function getRefreshCoalesceKey(type: ServerEventType, payload: ServerEventMap[ServerEventType]): string | null {
  switch (type) {
    case "adventures:delta": {
      const p = payload as ServerEventMap["adventures:delta"];
      return p.action === "refresh" ? `${type}:${p.campaignId}` : null;
    }
    case "encounters:delta": {
      const p = payload as ServerEventMap["encounters:delta"];
      return p.action === "refresh"
        ? `${type}:${p.campaignId}:${p.adventureId}`
        : null;
    }
    case "notes:delta": {
      const p = payload as ServerEventMap["notes:delta"];
      return p.action === "refresh"
        ? `${type}:${p.campaignId}:${p.adventureId ?? "campaign"}`
        : null;
    }
    case "players:delta":
    case "inpcs:delta":
    case "partyInventory:delta":
    case "bastions:delta": {
      const p = payload as
        | ServerEventMap["players:delta"]
        | ServerEventMap["inpcs:delta"]
        | ServerEventMap["partyInventory:delta"]
        | ServerEventMap["bastions:delta"];
      return p.action === "refresh" ? `${type}:${p.campaignId}` : null;
    }
    case "treasure:delta": {
      const p = payload as ServerEventMap["treasure:delta"];
      return p.action === "refresh"
        ? `${type}:${p.campaignId}:${p.adventureId ?? "campaign"}`
        : null;
    }
    case "encounter:combatantsDelta": {
      const p = payload as ServerEventMap["encounter:combatantsDelta"];
      return p.action === "refresh" ? `${type}:${p.encounterId}` : null;
    }
    default:
      return null;
  }
}
