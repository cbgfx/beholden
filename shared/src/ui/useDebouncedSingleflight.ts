import React from "react";

export function useDebouncedSingleflight(run: () => Promise<void> | void) {
  const timerRef = React.useRef<number | null>(null);
  const inflightRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const runRef = React.useRef(run);

  React.useEffect(() => {
    runRef.current = run;
  }, [run]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const enqueue = React.useCallback((delayMs = 150) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const execute = () => {
        if (inflightRef.current) {
          pendingRef.current = true;
          return;
        }
        inflightRef.current = true;
        Promise.resolve(runRef.current())
          .catch(() => {})
          .finally(() => {
            inflightRef.current = false;
            if (pendingRef.current) {
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

