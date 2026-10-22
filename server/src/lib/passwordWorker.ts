import { Worker } from "node:worker_threads";
import path from "node:path";
import { serverRootDir } from "../config/installation.js";

type Pending = { resolve: (value: string | boolean) => void; reject: (error: Error) => void };
type PasswordWorker = { worker: Worker; pending: Map<number, Pending>; idleTimer?: NodeJS.Timeout };
const IDLE_TIMEOUT_MS = 30_000;
let active: PasswordWorker | undefined;
let nextId = 0;

function releaseWhenIdle(state: PasswordWorker) {
  if (state.pending.size !== 0) return;
  state.worker.unref();
  state.idleTimer = setTimeout(() => {
    if (active !== state || state.pending.size !== 0) return;
    active = undefined;
    void state.worker.terminate();
  }, IDLE_TIMEOUT_MS);
  state.idleTimer.unref();
}

function getWorker(): PasswordWorker {
  if (active) return active;
  const worker = new Worker(path.join(serverRootDir, "scripts/passwordWorker.mjs"), { execArgv: [] });
  const state: PasswordWorker = { worker, pending: new Map<number, Pending>() };
  const fail = () => {
    clearTimeout(state.idleTimer);
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
    releaseWhenIdle(state);
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
  clearTimeout(state.idleTimer);
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    state.pending.set(id, { resolve, reject });
    state.worker.ref();
    try {
      state.worker.postMessage({ id, operation, password, hash });
    } catch {
      state.pending.delete(id);
      releaseWhenIdle(state);
      reject(new Error("Could not dispatch password operation"));
    }
  });
}
