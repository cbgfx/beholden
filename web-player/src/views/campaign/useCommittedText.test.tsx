// @vitest-environment jsdom
/**
 * Facility notes save when typing pauses or the field loses focus, not per keystroke, and an
 * incoming change never overwrites text that's still being typed.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useCommittedText } from "@beholden/shared/ui/useCommittedText";

type Field = ReturnType<typeof useCommittedText>;
type Commit = (next: string) => Promise<boolean> | boolean | void;

async function mount(initial: string, commit: Commit) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  let field!: Field;
  function Harness(props: { value: string }) {
    field = useCommittedText(props.value, commit, 2000);
    return null;
  }
  await act(async () => root.render(<Harness value={initial} />));
  return {
    field: () => field,
    /** Re-renders with a new value from outside, as a refresh or someone else's edit would. */
    receive: (value: string) => act(async () => root.render(<Harness value={value} />)),
    type: (text: string) => act(async () => field.onChange(text)),
    blur: () => act(async () => field.onBlur()),
    unmount: () => act(async () => root.unmount()),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("commits once after typing pauses, not on every keystroke", async () => {
  vi.useFakeTimers();
  const commit = vi.fn(() => true);
  const notes = await mount("", commit);
  await notes.type("H");
  await notes.type("He");
  await notes.type("Herbs");
  expect(commit).not.toHaveBeenCalled();

  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith("Herbs");
  await notes.unmount();
});

it("commits on blur, and only when the text actually changed", async () => {
  const commit = vi.fn(() => true);
  const notes = await mount("Old", commit);
  await notes.blur();
  expect(commit).not.toHaveBeenCalled();

  await notes.type("New");
  await notes.blur();
  await notes.blur();
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith("New");
  await notes.unmount();
});

it("never replaces text being typed with an incoming change, but updates an idle field", async () => {
  const busy = await mount("", vi.fn(() => true));
  await busy.type("Mine, half typed");
  await busy.receive("Theirs");
  expect(busy.field().text).toBe("Mine, half typed");
  await busy.unmount();

  const idle = await mount("", vi.fn(() => true));
  await idle.receive("Theirs");
  expect(idle.field().text).toBe("Theirs");
  await idle.unmount();
});

it("keeps the text when a commit is refused, so it can be saved again", async () => {
  const commit = vi.fn<Commit>().mockResolvedValueOnce(false).mockResolvedValue(true);
  const notes = await mount("", commit);
  await notes.type("Keep this");
  await notes.blur();
  expect(notes.field().text).toBe("Keep this");

  await notes.blur();
  expect(commit).toHaveBeenCalledTimes(2);
  expect(commit).toHaveBeenLastCalledWith("Keep this");
  await notes.unmount();
});

it("saves a pending edit when the field goes away", async () => {
  const commit = vi.fn(() => true);
  const notes = await mount("", commit);
  await notes.type("Unsaved");
  await notes.unmount();
  expect(commit).toHaveBeenCalledWith("Unsaved");
});
