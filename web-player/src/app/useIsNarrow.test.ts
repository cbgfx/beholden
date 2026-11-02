// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook } from "@beholden/shared/tests/renderHook";
import { useIsNarrow } from "@beholden/shared/ui/useIsNarrow";

afterEach(() => vi.unstubAllGlobals());

it("reads the initial breakpoint, responds to changes, and removes old subscriptions", async () => {
  const first = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const second = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn((query: string) => query === "(max-width: 760px)" ? first : second));
  const initialValues: boolean[] = [];
  const hook = await renderHook((query: string) => {
    const matches = useIsNarrow(query);
    initialValues.push(matches);
    return matches;
  }, "(max-width: 760px)");
  expect(initialValues[0]).toBe(true);
  const listener = first.addEventListener.mock.calls[0][1];
  first.matches = false;
  await act(async () => listener());
  expect(hook.result).toBe(false);
  await hook.rerender("(max-width: 980px)");
  expect(first.removeEventListener).toHaveBeenCalledWith("change", listener);
  expect(second.addEventListener).toHaveBeenCalledTimes(1);
  await hook.unmount();
  expect(second.removeEventListener).toHaveBeenCalledWith("change", second.addEventListener.mock.calls[0][1]);
});

it("uses only the legacy listener when modern media-query listeners are unavailable", async () => {
  const media = { matches: true, addListener: vi.fn(), removeListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => media);
  const hook = await renderHook(() => useIsNarrow());
  const listener = media.addListener.mock.calls[0][0];
  media.matches = false;
  await act(async () => listener());
  expect(hook.result).toBe(false);
  await hook.unmount();
  expect(media.removeListener).toHaveBeenCalledWith(listener);
});

it("can render in environments without matchMedia", async () => {
  vi.stubGlobal("matchMedia", undefined);
  const hook = await renderHook(() => useIsNarrow());
  expect(hook.result).toBe(false);
});
