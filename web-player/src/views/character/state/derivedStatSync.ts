/**
 * Pushes a character's client-derived AC / HP-max / speed to the server so the DM
 * view mirrors them. Only one request is in flight at a time; a value is marked
 * acknowledged *after* the server confirms it (not before), so a failed push is
 * retried and never mistaken for success. Newer desired values always win over an
 * older in-flight or failed attempt.
 */
export interface DerivedStats {
  charId: string;
  ac: number | null;
  hpMax: number;
  speed: number | null;
}

export interface DerivedStatSyncOptions {
  retryMs?: number;
  maxRetries?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

const sameStats = (a: DerivedStats | null, b: DerivedStats | null): boolean =>
  Boolean(a && b && a.charId === b.charId && a.ac === b.ac && a.hpMax === b.hpMax && a.speed === b.speed);

export function createDerivedStatSync(
  put: (charId: string, body: Record<string, number>) => Promise<unknown>,
  options: DerivedStatSyncOptions = {},
) {
  const retryMs = options.retryMs ?? 5000;
  const maxRetries = options.maxRetries ?? 5;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let acknowledged: DerivedStats | null = null;
  let inFlight: DerivedStats | null = null;
  let desired: DerivedStats | null = null;
  let attempts = 0;
  let timer: unknown = null;
  let alive = true;

  const clearTimer = () => {
    if (timer != null) {
      cancel(timer);
      timer = null;
    }
  };

  const flush = () => {
    if (!alive || !desired) return;
    if (sameStats(desired, acknowledged) || inFlight) return;
    const attempt = desired;
    inFlight = attempt;
    void put(attempt.charId, {
      syncedHpMax: attempt.hpMax,
      ...(attempt.ac != null ? { syncedAc: attempt.ac } : {}),
      ...(attempt.speed != null ? { syncedSpeed: attempt.speed } : {}),
    })
      .then(() => {
        inFlight = null;
        if (!alive) return;
        acknowledged = attempt;
        attempts = 0;
        // Desired changed while this request was in flight — send the newer values now.
        if (!sameStats(desired, acknowledged)) flush();
      })
      .catch(() => {
        inFlight = null;
        if (!alive || attempts >= maxRetries) return;
        attempts += 1;
        clearTimer();
        timer = schedule(() => { timer = null; flush(); }, retryMs);
      });
  };

  return {
    /** Record the latest desired stats (or `null` to stand down) and try to persist them. */
    set(next: DerivedStats | null) {
      if (!sameStats(next, desired)) attempts = 0; // a genuinely new target gets a full retry budget
      desired = next;
      flush();
    },
    /** Re-attempt a pending push immediately, e.g. once a websocket message proves the link is back. */
    poke() {
      if (!alive) return;
      if (attempts > 0 || (desired && !sameStats(desired, acknowledged) && !inFlight)) {
        clearTimer();
        flush();
      }
    },
    dispose() {
      alive = false;
      clearTimer();
    },
  };
}
