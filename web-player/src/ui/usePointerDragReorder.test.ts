// @vitest-environment jsdom
import type React from "react";
import { expect, it, vi } from "vitest";

import { act } from "react";
import { renderHook } from "@beholden/shared/tests/renderHook";
import { usePointerDragReorder } from "@beholden/shared/ui/usePointerDragReorder";

function pointer(clientY: number, button = 0) {
  return { clientY, clientX: 0, button, pointerId: 1,
    preventDefault() {}, stopPropagation() {}, currentTarget: { setPointerCapture() {} },
  } as unknown as React.PointerEvent;
}

async function setup() {
  const onReorder = vi.fn();
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const hook = await renderHook(() => usePointerDragReorder({ items, onReorder }));
  for (const [index, id] of ["a", "b", "c"].entries()) {
    hook.result.rowRefs.current[id] = { getBoundingClientRect: () => ({ top: index * 30, bottom: (index + 1) * 30 }) } as HTMLDivElement;
  }
  act(() => { hook.result.onHandlePointerDown(pointer(10), "a"); });
  return { hook, onReorder };
}

it("commits the latest move before another render or effect flush", async () => {
  const { hook, onReorder } = await setup();
  const drag = hook.result;
  act(() => { drag.onHandlePointerMove(pointer(75)); drag.endDrag(true); });
  expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "c", "a"]);
});

it("does not save cancelled or unmoved drags", async () => {
  const { hook, onReorder } = await setup();
  const drag = hook.result;
  act(() => { drag.endDrag(true); });
  expect(onReorder).not.toHaveBeenCalled();
  act(() => { hook.result.onHandlePointerDown(pointer(10), "a"); });
  act(() => { hook.result.onHandlePointerMove(pointer(75)); hook.result.endDrag(false); });
  expect(onReorder).not.toHaveBeenCalled();
});

it("ignores secondary mouse buttons", async () => {
  const { hook } = await setup();
  act(() => { hook.result.endDrag(false); });
  act(() => { hook.result.onHandlePointerDown(pointer(10, 2), "a"); });
  expect(hook.result.dragId).toBeNull();
});
