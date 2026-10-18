import { Worker } from "node:worker_threads";

type Pending = { resolve: (value: string | boolean) => void; reject: (error: Error) => void };
type PasswordWorker = { worker: Worker; pending: Map<number, Pending> };
let active: PasswordWorker | undefined;
let nextId = 0;

function getWorker(): PasswordWorker {
  if (active) return active;
  // The script has the same relative location from both src/lib and dist/lib.
  const worker = new Worker(new URL("../../scripts/passwordWorker.mjs", import.meta.url), { execArgv: [] });
  const state = { worker, pending: new Map<number, Pending>() };
  const fail = () => {
    if (active === state) active = undefined;
    for (const task of state.pending.values()) task.reject(new Error("Password worker stopped"));
    state.pending.clear();
  };
  worker.on("message", ({ id, value, error }: { id: number; value: string | boolean; error?: string }) => {
    const task = state.pending.get(id);
    if (!task) return;
    state.pending.delete(id);
    if (error) task.reject(new Error(error));
    else task.resolve(value);
    if (state.pending.size === 0) worker.unref();
  });
  worker.on("error", fail);
  worker.on("exit", fail);
  worker.unref();
  active = state;
  return state;
}

/** A single reusable CPU worker keeps hashing off the request/WebSocket event loop. */
export function runPasswordTask(operation: "hash", password: string): Promise<string>;
export function runPasswordTask(operation: "verify", password: string, hash: string): Promise<boolean>;
export function runPasswordTask(operation: "hash" | "verify", password: string, hash?: string): Promise<string | boolean> {
  const state = getWorker();
  // Bound queued secrets and work; request rate limiting normally prevents reaching this.
  if (state.pending.size >= 64) return Promise.reject(new Error("Password service is busy; try again shortly"));
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    state.pending.set(id, { resolve, reject });
    state.worker.ref();
    try {
      state.worker.postMessage({ id, operation, password, hash });
    } catch {
      state.pending.delete(id);
      if (state.pending.size === 0) state.worker.unref();
      reject(new Error("Could not dispatch password operation"));
    }
  });
}
