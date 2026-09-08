import type React from "react";
import { beforeEach, expect, it, vi } from "vitest";

// A deliberately deferred render harness: pointer-move and pointer-up share
// the same rendered callbacks, as they can when React batches updates.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock("react", () => ({ default: {
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => {
      hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value;
    }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
} }));

import { usePointerDragReorder } from "@beholden/shared/ui/usePointerDragReorder";

beforeEach(() => { hooks.slots = []; hooks.cursor = 0; });

function pointer(clientY: number, button = 0) {
  return { clientY, clientX: 0, button, pointerId: 1,
    preventDefault() {}, stopPropagation() {}, currentTarget: { setPointerCapture() {} },
  } as unknown as React.PointerEvent;
}

function setup() {
  const onReorder = vi.fn();
  const Render = () => {
    hooks.cursor = 0;
    return usePointerDragReorder({ items: [{ id: "a" }, { id: "b" }, { id: "c" }], onReorder });
  };
  let drag = Render();
  for (const [index, id] of ["a", "b", "c"].entries()) {
    drag.rowRefs.current[id] = { getBoundingClientRect: () => ({ top: index * 30, bottom: (index + 1) * 30 }) } as HTMLDivElement;
  }
  drag.onHandlePointerDown(pointer(10), "a");
  drag = Render();
  return { drag, onReorder, render: Render };
}

it("commits the latest move before another render or effect flush", () => {
  const { drag, onReorder } = setup();
  drag.onHandlePointerMove(pointer(75));
  drag.endDrag(true);
  expect(onReorder).toHaveBeenCalledExactlyOnceWith(["b", "c", "a"]);
});

it("does not save cancelled or unmoved drags", () => {
  const { drag, onReorder } = setup();
  drag.endDrag(true);
  expect(onReorder).not.toHaveBeenCalled();
  drag.onHandlePointerDown(pointer(10), "a");
  drag.onHandlePointerMove(pointer(75));
  drag.endDrag(false);
  expect(onReorder).not.toHaveBeenCalled();
});

it("ignores secondary mouse buttons", () => {
  const { drag, render } = setup();
  drag.endDrag(false);
  render().onHandlePointerDown(pointer(10, 2), "a");
  expect(render().dragId).toBeNull();
});
