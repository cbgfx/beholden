/** Owns one connection and one retry timer, independently of React. */
export function createWebSocketConnection(options: {
  url: () => string;
  fallbackUrl?: () => string;
  onSocket: (socket: WebSocket | null) => void;
  onOpen: (socket: WebSocket) => void;
  onMessage: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => boolean | void;
  /** Close the socket once the tab has stayed hidden this long, and reconnect when it is shown
   * again. A parked tab sends no traffic, so an idle host can sleep instead of billing compute. */
  parkWhenHiddenMs?: number;
}) {
  let stopped = false;
  let current: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let useFallback = false;
  // True while the socket is closed on purpose because the tab is hidden.
  let parked = false;
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;

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
    socket.onclose = (event) => {
      if (!isCurrent()) return;
      if (options.onClose?.(event) === false) {
        stopped = true;
        retire();
        return;
      }
      retry(opened);
    };
  }

  function park() {
    hiddenTimer = undefined;
    if (stopped) return;
    parked = true;
    retire();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(park, options.parkWhenHiddenMs);
      return;
    }
    // Shown again: cancel a pending park, or reconnect right away if already parked.
    // The normal onOpen path then lets the app refresh anything it missed.
    clearTimeout(hiddenTimer);
    hiddenTimer = undefined;
    if (!parked || stopped) return;
    parked = false;
    attempt = 0;
    connect();
  }

  const watchVisibility = options.parkWhenHiddenMs !== undefined && typeof document !== "undefined";
  if (watchVisibility) document.addEventListener("visibilitychange", onVisibilityChange);

  connect();
  return () => {
    stopped = true;
    clearTimeout(hiddenTimer);
    if (watchVisibility) document.removeEventListener("visibilitychange", onVisibilityChange);
    retire();
  };
}
