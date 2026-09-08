/** Owns one connection and one retry timer, independently of React. */
export function createWebSocketConnection(options: {
  url: () => string;
  fallbackUrl?: () => string;
  onSocket: (socket: WebSocket | null) => void;
  onOpen: (socket: WebSocket) => void;
  onMessage: (event: MessageEvent) => void;
}) {
  let stopped = false;
  let current: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let useFallback = false;

  function retire() {
    clearTimeout(timer);
    timer = undefined;
    const socket = current;
    current = null;
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
      try { socket.close(); } catch { /* Already closed. */ }
    }
    options.onSocket(null);
  }

  function retry(opened: boolean) {
    retire();
    if (stopped) return;
    if (!opened && !useFallback && options.fallbackUrl) {
      useFallback = true;
      connect();
      return;
    }
    const delay = Math.min(30000, 1000 * 2 ** attempt++ + Math.random() * 500);
    timer = setTimeout(connect, delay);
  }

  function connect() {
    if (stopped) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(useFallback && options.fallbackUrl ? options.fallbackUrl() : options.url());
    } catch {
      retry(false);
      return;
    }
    current = socket;
    options.onSocket(socket);
    let opened = false;
    const isCurrent = () => !stopped && current === socket;
    timer = setTimeout(() => { if (isCurrent()) retry(false); }, 800);
    socket.onopen = () => {
      if (!isCurrent()) return;
      opened = true;
      attempt = 0;
      clearTimeout(timer);
      timer = undefined;
      options.onOpen(socket);
    };
    socket.onmessage = (event) => { if (isCurrent()) options.onMessage(event); };
    socket.onerror = () => { if (isCurrent()) retry(opened); };
    socket.onclose = () => { if (isCurrent()) retry(opened); };
  }

  connect();
  return () => { stopped = true; retire(); };
}
