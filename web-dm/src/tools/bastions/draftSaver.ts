/** Drafts belong to a resource, not to whichever editor happens to be selected. */
export function createDraftSaver<T extends { id: string }>(options: {
  signature: (row: T) => string;
  put: (scope: string, row: T) => Promise<unknown>;
  status: (busy: boolean, error: string | null) => void;
}) {
  type Entry = { scope: string; row: T; saved: string; pending: boolean; inFlight?: string; timer?: ReturnType<typeof setTimeout>; error: string | null };
  let revision = 0;
  const entries = new Map<string, Entry>();
  const key = (scope: string, id: string) => JSON.stringify([scope, id]);
  const dirty = (entry: Entry) => options.signature(entry.row) !== entry.saved;
  const status = () => options.status([...entries.values()].some(e => e.pending), [...entries.values()].find(e => e.error)?.error ?? null);
  const send = async (entry: Entry, retry = false) => {
    if (entry.timer) { clearTimeout(entry.timer); delete entry.timer; }
    if (entry.pending || !dirty(entry) || (entry.error && !retry)) return;
    const row = entry.row;
    const sig = options.signature(row);
    entry.pending = true;
    entry.inFlight = sig;
    entry.error = null;
    status();
    try {
      await options.put(entry.scope, row);
      entry.saved = sig;
      revision++;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : "Failed to save Bastion. Retry to keep your edits.";
    } finally {
      entry.pending = false;
      delete entry.inFlight;
      status();
      // A failure remains dirty for explicit retry; don't loop on an unavailable server.
      if (!entry.error && entries.get(key(entry.scope, row.id)) === entry && dirty(entry)) void send(entry);
    }
  };
  const accept = (scope: string, row: T, readRevision = revision): T => {
    const k = key(scope, row.id);
    const entry = entries.get(k);
    if (entry && (entry.pending || dirty(entry) || readRevision !== revision)) {
      const incoming = options.signature(row);
      if (readRevision === revision && incoming !== entry.saved && incoming !== entry.inFlight && incoming !== options.signature(entry.row)) {
        if (entry.timer) { clearTimeout(entry.timer); delete entry.timer; }
        entry.error = "This Bastion changed elsewhere. Your draft was kept; review it before retrying the save.";
        status();
      }
      return entry.row;
    }
    entries.set(k, { scope, row, saved: options.signature(row), pending: false, error: null });
    return row;
  };
  return {
    accept,
    version: () => revision,
    merge(scope: string, rows: T[], readRevision = revision) {
      const merged = rows.map(row => accept(scope, row, readRevision));
      for (const entry of entries.values()) {
        if (entry.scope === scope && dirty(entry) && !merged.some(row => row.id === entry.row.id)) merged.push(entry.row);
      }
      status();
      return merged;
    },
    edit(scope: string, row: T) {
      revision++;
      const k = key(scope, row.id);
      const entry = entries.get(k) ?? { scope, row, saved: "", pending: false, error: null };
      entry.row = row;
      entries.set(k, entry);
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => { void send(entry); }, 350);
    },
    forget(scope: string, id: string) {
      const k = key(scope, id);
      const entry = entries.get(k);
      if (entry?.timer) clearTimeout(entry.timer);
      entries.delete(k);
      status();
    },
    // Navigation must not override a failed/conflicted draft's review requirement.
    flush() { for (const entry of entries.values()) if (!entry.error) void send(entry); },
    retry() { for (const entry of entries.values()) void send(entry, true); },
  };
}
