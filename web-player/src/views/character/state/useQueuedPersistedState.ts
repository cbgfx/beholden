import React from "react";

/** Optimistic state for values persisted as whole snapshots. Updates are
 * serialized so slower earlier requests cannot overwrite newer ones. The
 * current value lives in a ref, avoiding side effects inside React state
 * updater functions (which React may invoke more than once in development). */
export function useQueuedPersistedState<T>(externalValue: T, onSave: (value: T) => Promise<unknown>) {
  const [value, setValue] = React.useState(externalValue);
  const valueRef = React.useRef(externalValue);
  const saveRef = React.useRef(onSave);
  const saveQueueRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const pendingSavesRef = React.useRef(0);

  React.useEffect(() => { saveRef.current = onSave; }, [onSave]);
  React.useEffect(() => {
    if (pendingSavesRef.current !== 0) return;
    valueRef.current = externalValue;
    setValue(externalValue);
  }, [externalValue]);

  const update = React.useCallback((updater: (current: T) => T) => {
    const next = updater(valueRef.current);
    valueRef.current = next;
    setValue(next);
    pendingSavesRef.current += 1;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveRef.current(next))
      .finally(() => { pendingSavesRef.current -= 1; });
  }, []);

  return [value, update] as const;
}
