import React from "react";

export function useDebouncedSingleflight(run: () => Promise<void> | void) {
  const timerRef = React.useRef<number | null>(null);
  const inflightRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const runRef = React.useRef(run);
  const activeRef = React.useRef(true);

  React.useEffect(() => {
    runRef.current = run;
  }, [run]);

  React.useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      pendingRef.current = false;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const enqueue = React.useCallback((delayMs = 150) => {
    if (!activeRef.current) return;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const execute = () => {
        if (!activeRef.current) return;
        if (inflightRef.current) {
          pendingRef.current = true;
          return;
        }
        inflightRef.current = true;
        Promise.resolve().then(() => {
          if (activeRef.current) return runRef.current();
        })
          .catch(() => {})
          .finally(() => {
            inflightRef.current = false;
            if (activeRef.current && pendingRef.current) {
              pendingRef.current = false;
              execute();
            }
          });
      };
      execute();
    }, delayMs);
  }, []);

  return enqueue;
}
