import React from "react";

type TaskState = {
  timer: number | null;
  inflight: boolean;
  pending: boolean;
  run: () => Promise<void> | void;
};

export function useDebouncedTaskQueue() {
  const active = React.useRef(true);
  const taskStateRef = React.useRef(new Map<string, TaskState>());

  React.useEffect(() => {
    active.current = true;
    const taskStates = taskStateRef.current;
    return () => {
      active.current = false;
      for (const state of taskStates.values()) {
        if (state.timer != null) window.clearTimeout(state.timer);
      }
      taskStates.clear();
    };
  }, []);

  const enqueue = React.useCallback(
    (key: string, run: () => Promise<void> | void, delayMs = 150) => {
      if (!active.current) return;
      let state = taskStateRef.current.get(key);
      if (!state) {
        state = { timer: null, inflight: false, pending: false, run };
        taskStateRef.current.set(key, state);
      }

      state.run = run;
      if (state.timer != null) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        state!.timer = null;
        const execute = () => {
          if (!active.current || taskStateRef.current.get(key) !== state) return;
          if (state!.inflight) {
            state!.pending = true;
            return;
          }

          state!.inflight = true;
          Promise.resolve().then(() => {
            if (active.current && taskStateRef.current.get(key) === state) return state!.run();
          })
            .catch(() => {})
            .finally(() => {
              state!.inflight = false;
              if (active.current && taskStateRef.current.get(key) === state && state!.pending) {
                state!.pending = false;
                execute();
              }
            });
        };
        execute();
      }, delayMs);
    },
    [],
  );

  return enqueue;
}
