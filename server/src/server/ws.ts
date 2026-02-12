import { WebSocketServer } from "ws";

export function createWsServer({ httpServer, path = "/ws", onConnectionHello }) {
  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (ws) => {
    if (onConnectionHello) onConnectionHello(ws);
  });

  return wss;
}

export function createBroadcaster(wss) {
  return function broadcast(type, payload) {
    if (!wss) return;
    const msg = JSON.stringify({ type, payload });
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  };
}
