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
  const wss = new WebSocketServer({ server: httpServer, path });

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
  const broadcast = (<K extends ServerEventType>(type: K, payload: ServerEventMap[K]) => {
    if (!wss) return;
    const msg = JSON.stringify({ type, payload });
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  }) as BroadcastFn;

  return broadcast;
}
