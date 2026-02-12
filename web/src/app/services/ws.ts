
import { useEffect } from "react";
export type WsMessage = { type: string; payload?: any };

export function useWs(onMessage: (msg: WsMessage) => void) {
  useEffect(() => {
    const wsProto = location.protocol === "https:" ? "wss" : "ws";
    const host = location.hostname;
    const url = `${wsProto}://${host}:5174/ws`;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch {} };
    ws.onerror = () => {};
    return () => ws.close();
  }, [onMessage]);
}
