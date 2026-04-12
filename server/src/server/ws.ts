import type { Server } from "http";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import type { BroadcastFn, ServerEventMap, ServerEventType } from "./events.js";
type WsScope = {
  campaignId?: string | null;
  adventureId?: string | null;
  encounterId?: string | null;
};

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
    (ws as WebSocket & { __beholdenScope?: WsScope }).__beholdenScope = {};
    if (authorize && !authorize(req)) {
      try { ws.close(1008, "Unauthorized"); } catch {}
      return;
    }
    ws.on("message", (raw) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as { type?: unknown; payload?: unknown };
        if (parsed.type !== "ws:scope") return;
        const payload = (parsed.payload && typeof parsed.payload === "object") ? parsed.payload as WsScope : {};
        (ws as WebSocket & { __beholdenScope?: WsScope }).__beholdenScope = {
          campaignId: typeof payload.campaignId === "string" && payload.campaignId ? payload.campaignId : null,
          adventureId: typeof payload.adventureId === "string" && payload.adventureId ? payload.adventureId : null,
          encounterId: typeof payload.encounterId === "string" && payload.encounterId ? payload.encounterId : null,
        };
      } catch {
        // ignore malformed frames
      }
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
  const pendingRefresh = new Map<string, {
    type: ServerEventType;
    payload: ServerEventMap[ServerEventType];
    msg: string;
  }>();
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
      for (const pending of messages) {
        if (!shouldDeliverToScope(ws, pending.type, pending.payload)) continue;
        ws.send(pending.msg);
      }
    }
  };

  const queueRefresh = (key: string, value: { type: ServerEventType; payload: ServerEventMap[ServerEventType]; msg: string }) => {
    pendingRefresh.set(key, value);
    if (!flushTimer) {
      flushTimer = setTimeout(flushPendingRefresh, refreshCoalesceWindowMs);
    }
  };

  const broadcast = (<K extends ServerEventType>(type: K, payload: ServerEventMap[K]) => {
    if (!wss) return;
    if (refreshCoalesceWindowMs > 0) {
      const refreshKey = getRefreshCoalesceKey(type, payload);
      if (refreshKey) {
        queueRefresh(refreshKey, {
          type,
          payload: payload as ServerEventMap[ServerEventType],
          msg: JSON.stringify({ type, payload }),
        });
        return;
      }
    }
    const msg = JSON.stringify({ type, payload });
    for (const ws of wss.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (!shouldDeliverToScope(ws, type, payload)) continue;
      ws.send(msg);
    }
  }) as BroadcastFn;

  return broadcast;
}

function shouldDeliverToScope(
  ws: WebSocket,
  type: ServerEventType,
  payload: ServerEventMap[ServerEventType],
): boolean {
  const scope = (ws as WebSocket & { __beholdenScope?: WsScope }).__beholdenScope;
  if (!scope) return true;
  const scopeCampaign = typeof scope.campaignId === "string" && scope.campaignId ? scope.campaignId : null;
  const scopeAdventure = typeof scope.adventureId === "string" && scope.adventureId ? scope.adventureId : null;
  const scopeEncounter = typeof scope.encounterId === "string" && scope.encounterId ? scope.encounterId : null;

  const payloadObj = (payload && typeof payload === "object") ? payload as Record<string, unknown> : null;
  const payloadCampaign = payloadObj && typeof payloadObj.campaignId === "string" ? payloadObj.campaignId : null;
  const payloadAdventure = payloadObj && typeof payloadObj.adventureId === "string" ? payloadObj.adventureId : null;
  const payloadEncounter = payloadObj && typeof payloadObj.encounterId === "string" ? payloadObj.encounterId : null;

  if (scopeCampaign && payloadCampaign && payloadCampaign !== scopeCampaign) return false;
  if (scopeAdventure && payloadAdventure && payloadAdventure !== scopeAdventure) return false;
  if (scopeEncounter && payloadEncounter && payloadEncounter !== scopeEncounter) return false;
  return true;
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
