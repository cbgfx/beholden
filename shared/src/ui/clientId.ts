/**
 * A stable id for this browser tab.
 *
 * Writes that trigger a WebSocket broadcast send this along, and the server echoes it back on the
 * resulting event. Every socket receives that broadcast -- including the one belonging to whoever
 * made the change -- so without a way to recognise your own echo, each autosave comes straight back
 * as a "something changed, reload everything" instruction and the editor reloads under you.
 *
 * Per tab rather than per session: two tabs open on the same record genuinely do need to hear about
 * each other's writes.
 */
let cachedClientId: string | null = null;

export function getClientId(): string {
  if (cachedClientId) return cachedClientId;
  const globalCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  cachedClientId = globalCrypto?.randomUUID
    ? globalCrypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return cachedClientId;
}

/**
 * True when this event is the echo of a write made by this tab, and can be ignored.
 *
 * An event with no origin is never ours: it came from another client, or from an older build that
 * didn't identify itself, and in both cases the safe answer is to refresh.
 */
export function isOwnEcho(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const origin = (payload as { originClientId?: unknown }).originClientId;
  return typeof origin === "string" && origin === getClientId();
}
