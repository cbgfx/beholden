import React from "react";

type TaskState = {
  timer: number | null;
  inflight: boolean;
  pending: boolean;
};

export function useDebouncedTaskQueue() {
  const taskStateRef = React.useRef(new Map<string, TaskState>());

  React.useEffect(() => {
    return () => {
      for (const state of taskStateRef.current.values()) {
        if (state.timer != null) window.clearTimeout(state.timer);
      }
      taskStateRef.current.clear();
    };
  }, []);

  const enqueue = React.useCallback(
    (key: string, run: () => Promise<void> | void, delayMs = 150) => {
      let state = taskStateRef.current.get(key);
      if (!state) {
        state = { timer: null, inflight: false, pending: false };
        taskStateRef.current.set(key, state);
      }

      if (state.timer != null) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        state!.timer = null;
        const execute = () => {
          if (state!.inflight) {
            state!.pending = true;
            return;
          }

          state!.inflight = true;
          Promise.resolve(run())
            .catch(() => {})
            .finally(() => {
              state!.inflight = false;
              if (state!.pending) {
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

