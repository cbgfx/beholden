import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach } from "vitest";

const mounted = new Set<() => Promise<void>>();
afterEach(async () => { for (const unmount of [...mounted]) await unmount(); });

/** Real React effects and rerenders; callers mock only their external dependencies. */
export async function renderHook<T, P = undefined>(useHook: (props: P) => T, initialProps: NoInfer<P> = undefined as P) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let current!: T;
  function Probe({ value }: { value: P }) { current = useHook(value); return null; }
  const rerender = async (value: P) => { await act(async () => { root.render(createElement(Probe, { value })); }); };
  const unmount = async () => {
    if (!mounted.delete(unmount)) return;
    await act(async () => { root.unmount(); });
    host.remove();
  };
  mounted.add(unmount);
  await rerender(initialProps);
  return { get result() { return current; }, rerender, unmount };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
