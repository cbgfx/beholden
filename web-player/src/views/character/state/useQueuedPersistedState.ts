import React from "react";

const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
const versionOf = (response: unknown): number | undefined => {
  if (!response || typeof response !== "object" || !("updatedAt" in response)) return undefined;
  return typeof response.updatedAt === "number" ? response.updatedAt : undefined;
};

/** Serializes optimistic snapshots, preserves failed drafts, and reconciles updates after drain. */
export function useQueuedPersistedState<T>(externalValue: T, onSave: (value: T) => Promise<unknown>, externalVersion?: number) {
  const [value, setValue] = React.useState(externalValue);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const valueRef = React.useRef(externalValue);
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;
  const external = React.useRef({ value: externalValue, version: externalVersion, revision: 0 });
  if (!Object.is(external.current.value, externalValue) || external.current.version !== externalVersion) {
    external.current = { value: externalValue, version: externalVersion, revision: external.current.revision + 1 };
  }
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const pending = React.useRef(0);
  const sequence = React.useRef(0);
  const errorRef = React.useRef<string | null>(null);
  const acknowledged = React.useRef<number | undefined>(externalVersion);
  const echoes = React.useRef<T[]>([]);
  const batchRevision = React.useRef(0);
  const active = React.useRef(true);
  const generation = React.useRef(0);
  React.useEffect(() => {
    active.current = true;
    const owner = generation.current;
    return () => { active.current = false; generation.current = owner + 1; };
  }, []);

  const reconcile = React.useCallback(() => {
    const incoming = external.current;
    if (incoming.version !== undefined && acknowledged.current !== undefined && incoming.version < acknowledged.current) return;
    // Without server versions, an echo of an earlier queued write must not replace its successor.
    if ((incoming.version === undefined || acknowledged.current === undefined || incoming.version <= acknowledged.current) && echoes.current.slice(0, -1).some(saved => same(saved, incoming.value))
      && !same(echoes.current.at(-1), incoming.value)) return;
    valueRef.current = incoming.value;
    setValue(incoming.value);
  }, []);
  React.useEffect(() => {
    if (pending.current === 0 && !errorRef.current) reconcile();
  }, [externalValue, externalVersion, reconcile]);

  const persist = React.useCallback((next: T) => {
    if (!active.current) return;
    const owner = generation.current;
    const job = ++sequence.current;
    const save = saveRef.current;
    if (pending.current === 0) { batchRevision.current = external.current.revision; echoes.current = []; }
    pending.current++;
    errorRef.current = null; setError(null); setBusy(true);
    queue.current = queue.current.then(async () => {
      if (!active.current || owner !== generation.current) return;
      const response = await save(next);
      if (!active.current || owner !== generation.current) return;
      const version = versionOf(response);
      if (version !== undefined) acknowledged.current = Math.max(acknowledged.current ?? version, version);
      echoes.current.push(next);
      if (job === sequence.current) { errorRef.current = null; setError(null); }
    }).catch((cause: unknown) => {
      if (active.current && owner === generation.current && job === sequence.current) {
        errorRef.current = cause instanceof Error ? cause.message : "Unable to save. Please try again.";
        setError(errorRef.current);
      }
    }).finally(() => {
      pending.current--;
      if (active.current && owner === generation.current && pending.current === 0) {
        setBusy(false);
        if (!errorRef.current && external.current.revision !== batchRevision.current) reconcile();
      }
    });
  }, [reconcile]);
  const update = React.useCallback((updater: (current: T) => T) => {
    if (!active.current) return;
    const next = updater(valueRef.current);
    valueRef.current = next; setValue(next); persist(next);
  }, [persist]);
  const retry = React.useCallback(() => { if (pending.current === 0 && errorRef.current) persist(valueRef.current); }, [persist]);
  return [value, update, { busy, error, retry }] as const;
}
