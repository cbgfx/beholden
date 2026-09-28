/**
 * Runs edits to one server record as operations, one at a time, while keeping the screen ahead of
 * the server.
 *
 * Each operation has a local `apply`, shown immediately, and a `send` that performs it on the server
 * and resolves to the saved record. What's displayed is always the last record the server confirmed
 * with every still-pending operation re-applied on top. So a response never briefly undoes a later
 * edit that hasn't landed yet, and a refused operation simply drops out of the display.
 *
 * Framework-free so the player and DM apps can share it.
 */
export function createOperationQueue<T>(options: {
  /** Called with the record to display whenever it changes. */
  onChange: (record: T | null) => void;
  /** Called when an operation is refused or fails. Later operations still run. */
  onError?: (error: unknown) => void;
  /** True while any operation is queued or in flight. */
  onBusyChange?: (busy: boolean) => void;
  /** A record's server version (e.g. `updatedAt`), used to ignore a record older than the one shown. */
  version?: (record: T) => number | undefined;
}) {
  type Pending = { apply: (record: T) => T };
  let confirmed: T | null = null;
  const pending: Pending[] = [];
  let tail: Promise<unknown> = Promise.resolve();

  const display = (): T | null =>
    confirmed === null ? null : pending.reduce<T>((record, operation) => operation.apply(record), confirmed);
  const publish = () => options.onChange(display());

  /** True when `incoming` is known to predate the confirmed record. */
  const isOlder = (incoming: T): boolean => {
    if (confirmed === null || !options.version) return false;
    const incomingVersion = options.version(incoming);
    const confirmedVersion = options.version(confirmed);
    return incomingVersion !== undefined && confirmedVersion !== undefined && incomingVersion < confirmedVersion;
  };

  return {
    /**
     * A record read from the server: the first load, or a refresh after someone else's change.
     * Pending operations stay applied on top. A record older than the confirmed one is ignored, since
     * a slow refresh can land after a newer response.
     */
    receive(record: T | null) {
      if (record !== null && isOlder(record)) return;
      confirmed = record;
      publish();
    },

    /**
     * Shows `apply` at once and queues `send` behind any operations already running. Resolves to
     * whether the server accepted it. Pass an identity `apply` for an operation that shouldn't be
     * shown before the server confirms it.
     */
    run(apply: (record: T) => T, send: () => Promise<T | null | undefined>): Promise<boolean> {
      const operation: Pending = { apply };
      pending.push(operation);
      publish();
      options.onBusyChange?.(true);

      const result = tail.then(async () => {
        try {
          const saved = await send();
          if (saved && !isOlder(saved)) confirmed = saved;
          return true;
        } catch (error) {
          options.onError?.(error);
          return false;
        } finally {
          pending.splice(pending.indexOf(operation), 1);
          publish();
          if (pending.length === 0) options.onBusyChange?.(false);
        }
      });
      tail = result;
      return result;
    },

    /** The record currently displayed. */
    current: display,
  };
}
