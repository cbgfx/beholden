// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createWebSocketConnection } from "@beholden/shared/ui/webSocketConnection";

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { FakeSocket.all.push(this); }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
  FakeSocket.all = [];
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup(fallback = true) {
  const onSocket = vi.fn();
  const onOpen = vi.fn();
  const onMessage = vi.fn();
  const stop = createWebSocketConnection({
    url: () => "ws://primary", fallbackUrl: fallback ? () => "ws://fallback" : undefined,
    onSocket, onOpen, onMessage,
  });
  return { stop, onSocket, onOpen, onMessage };
}

it("timeout starts one fallback and ignores queued events from the old socket", () => {
  const { stop, onSocket, onOpen, onMessage } = setup();
  const old = FakeSocket.all[0];
  const staleClose = old.onclose!;
  const staleOpen = old.onopen!;
  const staleMessage = old.onmessage!;
  vi.advanceTimersByTime(30_000);
  const replacement = FakeSocket.all[1];
  expect(replacement.url).toBe("ws://fallback");
  replacement.onopen!();
  staleClose(); staleOpen(); staleMessage({ data: "{}" } as MessageEvent);
  vi.advanceTimersByTime(30000);
  expect(FakeSocket.all).toHaveLength(2);
  expect(onSocket).toHaveBeenLastCalledWith(replacement);
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onMessage).not.toHaveBeenCalled();
  stop();
});

it("error followed by close schedules only one reconnect", () => {
  const { stop } = setup(false);
  const first = FakeSocket.all[0];
  first.onopen!();
  const close = first.onclose!;
  first.onerror!();
  close();
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1500);
  expect(FakeSocket.all).toHaveLength(2);
  stop();
});

it("cleanup cancels connection timeouts and queued callbacks", () => {
  const { stop, onOpen } = setup();
  const first = FakeSocket.all[0];
  const open = first.onopen!;
  stop(); open();
  vi.advanceTimersByTime(60000);
  expect(vi.getTimerCount()).toBe(0);
  expect(FakeSocket.all).toHaveLength(1);
  expect(first.close).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
});

it("cleanup cancels a pending reconnect", () => {
  const { stop } = setup(false);
  FakeSocket.all[0].onclose!();
  stop();
  vi.advanceTimersByTime(60000);
  expect(vi.getTimerCount()).toBe(0);
  expect(FakeSocket.all).toHaveLength(1);
});

it("reconnects using a freshly resolved URL/token", () => {
  let token = "old";
  const stop = createWebSocketConnection({ url: () => `ws://primary?token=${token}`,
    onSocket() {}, onOpen() {}, onMessage() {},
  });
  FakeSocket.all[0].onopen!();
  FakeSocket.all[0].onclose!();
  token = "new";
  vi.advanceTimersByTime(1500);
  expect(FakeSocket.all[1].url).toBe("ws://primary?token=new");
  stop();
});

it("stops reconnecting when authorization rejects the socket", () => {
  const rejected = vi.fn(() => false);
  const stop = createWebSocketConnection({
    url: () => "ws://primary", onSocket() {}, onOpen() {}, onMessage() {}, onClose: rejected,
  });
  const socket = FakeSocket.all[0];
  socket.onopen!();
  (socket.onclose as (event: CloseEvent) => void)({ code: 1008 } as CloseEvent);
  vi.advanceTimersByTime(60_000);
  expect(rejected).toHaveBeenCalledWith(expect.objectContaining({ code: 1008 }));
  expect(FakeSocket.all).toHaveLength(1);
  stop();
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

it("parks after staying hidden and reconnects when shown", () => {
  const onOpen = vi.fn();
  const stop = createWebSocketConnection({
    url: () => "ws://primary", onSocket() {}, onOpen, onMessage() {}, parkWhenHiddenMs: 600_000,
  });
  const first = FakeSocket.all[0];
  first.onopen!();
  setVisibility("hidden");
  vi.advanceTimersByTime(600_000);
  expect(first.close).toHaveBeenCalledTimes(1);
  // No reconnect attempts while parked.
  vi.advanceTimersByTime(3_600_000);
  expect(FakeSocket.all).toHaveLength(1);
  setVisibility("visible");
  expect(FakeSocket.all).toHaveLength(2);
  FakeSocket.all[1].onopen!();
  expect(onOpen).toHaveBeenCalledTimes(2);
  stop();
});

it("keeps the socket when the tab is shown again before the cutoff", () => {
  const stop = createWebSocketConnection({
    url: () => "ws://primary", onSocket() {}, onOpen() {}, onMessage() {}, parkWhenHiddenMs: 600_000,
  });
  const first = FakeSocket.all[0];
  first.onopen!();
  setVisibility("hidden");
  vi.advanceTimersByTime(599_000);
  setVisibility("visible");
  vi.advanceTimersByTime(600_000);
  expect(first.close).not.toHaveBeenCalled();
  expect(FakeSocket.all).toHaveLength(1);
  stop();
});

it("allows a slow host to wake without killing the connection attempt", () => {
  const { stop, onOpen } = setup(false);
  const first = FakeSocket.all[0];
  vi.advanceTimersByTime(15_000);
  expect(first.close).not.toHaveBeenCalled();
  first.onopen!();
  vi.advanceTimersByTime(60_000);
  expect(FakeSocket.all).toHaveLength(1);
  expect(onOpen).toHaveBeenCalledOnce();
  stop();
});
it("keeps visible sessions connected beyond the idle cutoff", () => {
  const stop = createWebSocketConnection({ url: () => "ws://primary", onSocket() {}, onOpen() {}, onMessage() {}, parkWhenHiddenMs: 600_000 });
  const first = FakeSocket.all[0]; first.onopen!();
  vi.advanceTimersByTime(3_600_000);
  expect(first.close).not.toHaveBeenCalled();
  expect(FakeSocket.all).toHaveLength(1);
  stop();
});
it("parks a tab that mounted hidden and resumes exactly once", () => {
  setVisibility("hidden");
  const stop = createWebSocketConnection({ url: () => "ws://primary", onSocket() {}, onOpen() {}, onMessage() {}, parkWhenHiddenMs: 600_000 });
  const first = FakeSocket.all[0]; first.onopen!();
  vi.advanceTimersByTime(600_000);
  expect(first.close).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(3_600_000);
  expect(FakeSocket.all).toHaveLength(1);
  setVisibility("visible");
  expect(FakeSocket.all).toHaveLength(2);
  stop();
});
it("returning to a disconnected tab bypasses reconnect backoff without duplicate attempts", () => {
  const stop = createWebSocketConnection({ url: () => "ws://primary", onSocket() {}, onOpen() {}, onMessage() {}, parkWhenHiddenMs: 600_000 });
  const first = FakeSocket.all[0]; first.onopen!();
  setVisibility("hidden"); first.onerror!();
  setVisibility("visible");
  expect(FakeSocket.all).toHaveLength(2);
  FakeSocket.all[1].onopen!();
  vi.advanceTimersByTime(600_000);
  expect(FakeSocket.all).toHaveLength(2);
  expect(FakeSocket.all[1].close).not.toHaveBeenCalled();
  stop();
});
